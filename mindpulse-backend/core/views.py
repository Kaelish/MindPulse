import base64
import binascii
import importlib
import logging
import os
import sys
import threading
import traceback

from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from rest_framework import generics, status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import VideoCallSession
from .serializers import VideoCallSessionSerializer, VideoCallStatusSerializer

logger = logging.getLogger(__name__)

# Runtime pieces the face scan needs. Reporting them from /api/health/ makes a
# broken deployment visible from outside: no dashboard access required.
DIAGNOSTIC_MODULES = ('emotion_model', 'mediapipe', 'cv2', 'numpy')
# Modules that are safe (and useful) to import from a health check, mapped to
# an attribute that only exists once the import has completely finished.
HEALTH_IMPORTS = {'emotion_model': 'predict_image'}


def _module_status(name):
	"""'ok', a version string, or 'unavailable: <error>'."""
	required = HEALTH_IMPORTS.get(name)
	if required:
		try:
			module = importlib.import_module(name)
			if not hasattr(module, required):
				return 'partially initialized'
		except Exception as exc:  # ImportError, OSError (missing .so), ...
			return 'unavailable: %s: %s' % (type(exc).__name__, exc)
	else:
		module = sys.modules.get(name)
		if module is None:
			return 'not imported'
	return getattr(module, '__version__', 'ok')


def _thread_stacks(limit=8):
	"""Current Python stack of every live thread (diagnostic aid)."""
	frames = sys._current_frames()
	stacks = {}
	for thread in threading.enumerate():
		frame = frames.get(thread.ident)
		if frame is None:
			continue
		stacks['%s|%s' % (thread.name, thread.ident)] = [
			'%s:%s %s' % (os.path.basename(entry.filename), entry.lineno,
						  entry.name)
			for entry in traceback.extract_stack(frame)[-limit:]]
	return stacks


def health_view(request):
	from .apps import WARMUP_STATE, ensure_warmup

	# The health check runs in the process that serves requests, which is not
	# necessarily the process that ran ready() (gunicorn forks its workers).
	# Starting warm-up here means the deployed worker always warms itself, and
	# Render's health check does it before the first user scan arrives.
	ensure_warmup()

	report = {name: _module_status(name) for name in DIAGNOSTIC_MODULES}
	report['warmup'] = WARMUP_STATE['status']
	if WARMUP_STATE['detail']:
		report['warmup_detail'] = WARMUP_STATE['detail']
	report['status'] = 'ok'
	if request.GET.get('stacks'):
		# `/api/health/?stacks=1` shows where a stuck thread is, which is the
		# only way to see inside a deployment that hangs without log access.
		report['threads'] = _thread_stacks()
	return JsonResponse(report)


class VideoCallSessionListCreateView(generics.ListCreateAPIView):
	queryset = VideoCallSession.objects.all()
	serializer_class = VideoCallSessionSerializer

	def get_queryset(self):
		queryset = super().get_queryset()
		patient_id = self.request.query_params.get('patient_id')
		doctor_id = self.request.query_params.get('doctor_id')
		if patient_id:
			queryset = queryset.filter(patient_id=patient_id)
		if doctor_id:
			queryset = queryset.filter(doctor_id=doctor_id)
		return queryset


class VideoCallSessionDetailView(generics.RetrieveUpdateAPIView):
	queryset = VideoCallSession.objects.all()
	serializer_class = VideoCallSessionSerializer

	def patch(self, request, *args, **kwargs):
		session = get_object_or_404(self.get_queryset(), pk=kwargs['pk'])
		serializer = VideoCallStatusSerializer(session, data=request.data, partial=True)
		serializer.is_valid(raise_exception=True)
		serializer.save()
		return Response(VideoCallSessionSerializer(session).data, status=status.HTTP_200_OK)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def predict_emotion_view(request):
	"""
	POST /api/predict-emotion/

	Accepts either:
	  - multipart/form-data with an "image" file field (web upload), or
	  - JSON {"image": "<base64 or data-URL>", "sad_bias": 0.15} (mobile).

	Returns 200 with {"label", "confidence", "probabilities", "runner_up"},
	400 when the image is missing/invalid or no face is detected, and 503 when
	the model is unavailable or detection exceeds its deadline.
	"""
	raw = None
	sad_bias = None

	upload = request.FILES.get('image') or request.FILES.get('file')
	if upload is not None:
		raw = upload.read()
	else:
		b64 = request.data.get('image')
		if isinstance(b64, str) and b64.strip():
			if ',' in b64 and b64.strip().lower().startswith('data:'):
				b64 = b64.split(',', 1)[1]
			try:
				raw = base64.b64decode(''.join(b64.split()), validate=True)
			except (binascii.Error, ValueError):
				return Response({'detail': 'Invalid base64 image data.'},
								status=status.HTTP_400_BAD_REQUEST)

		if raw is None:
			return Response(
				{'detail': 'No image provided. Send multipart field "image" '
						   'or JSON {"image": "<base64>"}.'},
				status=status.HTTP_400_BAD_REQUEST)

	bias = request.data.get('sad_bias')
	if bias not in (None, ''):
		try:
			sad_bias = float(bias)
		except (TypeError, ValueError):
			return Response({'detail': 'sad_bias must be a number.'},
							status=status.HTTP_400_BAD_REQUEST)

	# Validate the request before loading the face-model stack. A malformed
	# request must stay a 400 even when the inference dependencies are absent.
	try:
		from emotion_model import predict_image
	except ImportError as exc:
		logger.exception('Emotion model unavailable')
		return Response(
			{'detail': 'Emotion model unavailable: %s' % exc},
			status=status.HTTP_503_SERVICE_UNAVAILABLE)

	try:
		result = predict_image(raw, sad_bias=sad_bias)
	except TimeoutError:
		# Landmark detection has its own deadline (see emotion_model.predict_emotion)
		# so a stuck model returns quickly instead of being killed by gunicorn.
		logger.warning('Emotion prediction timed out')
		return Response(
			{'detail': 'The emotion service took too long to process this image. '
					   'Please try again.'},
			status=status.HTTP_503_SERVICE_UNAVAILABLE)
	except (ValueError, TypeError) as exc:
		return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
	except Exception:
		logger.exception('Emotion prediction failed')
		return Response({'detail': 'Prediction failed.'},
						status=status.HTTP_500_INTERNAL_SERVER_ERROR)

	if result is None:
		return Response({'detail': 'No face detected in the image.'},
						status=status.HTTP_400_BAD_REQUEST)

	return Response(result, status=status.HTTP_200_OK)
