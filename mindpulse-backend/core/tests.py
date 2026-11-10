import base64
import sys
from types import ModuleType
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import VideoCallSession

PREDICTION = {
	'label': 'Neutral',
	'confidence': 0.82,
	'probabilities': {'Happy': 0.10, 'Neutral': 0.82, 'Sad': 0.08},
	'runner_up': {'label': 'Happy', 'confidence': 0.10},
}


def fake_emotion_model(result=PREDICTION, side_effect=None):
	"""Stand-in for the MediaPipe/NumPy module used by the view.

	Unit tests must not need the inference stack, so the module is
	injected into sys.modules and predict_image is a mock. The test can then
	assert the request parsing and response mapping in isolation.
	"""
	module = ModuleType('emotion_model')
	module.predict_image = Mock(return_value=result, side_effect=side_effect)
	return module


class VideoCallSessionApiTests(APITestCase):
	def test_create_and_update_video_session(self):
		response = self.client.post(
			'/api/video-sessions/',
			{
				'appointment_id': 'appt-1',
				'patient_id': 'patient-456',
				'doctor_id': 'doctor-123',
				'room_name': 'mindpulse-doctor-123-patient-456',
				'meeting_url': 'https://mindpulse.daily.co/mindpulse-doctor-123-patient-456',
			},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		session_id = response.data['id']
		self.assertEqual(response.data['status'], VideoCallSession.Status.PENDING)

		update = self.client.patch(
			f'/api/video-sessions/{session_id}/',
			{'status': VideoCallSession.Status.ACTIVE},
			format='json',
		)

		self.assertEqual(update.status_code, status.HTTP_200_OK)
		self.assertEqual(update.data['status'], VideoCallSession.Status.ACTIVE)

	def test_filter_sessions_by_patient(self):
		VideoCallSession.objects.create(
			patient_id='patient-1',
			doctor_id='doctor-1',
			room_name='room-1',
		)
		VideoCallSession.objects.create(
			patient_id='patient-2',
			doctor_id='doctor-1',
			room_name='room-2',
		)

		response = self.client.get('/api/video-sessions/?patient_id=patient-1')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['patient_id'], 'patient-1')

	def test_filter_sessions_by_doctor(self):
		VideoCallSession.objects.create(
			patient_id='patient-1',
			doctor_id='doctor-1',
			room_name='room-1',
		)
		VideoCallSession.objects.create(
			patient_id='patient-1',
			doctor_id='doctor-2',
			room_name='room-2',
		)

		response = self.client.get('/api/video-sessions/?doctor_id=doctor-2')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['doctor_id'], 'doctor-2')

	def test_duplicate_room_name_is_rejected(self):
		VideoCallSession.objects.create(
			patient_id='patient-1',
			doctor_id='doctor-1',
			room_name='room-1',
		)

		response = self.client.post(
			'/api/video-sessions/',
			{
				'patient_id': 'patient-2',
				'doctor_id': 'doctor-1',
				'room_name': 'room-1',
			},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('room_name', response.data)

	def test_invalid_status_is_rejected(self):
		session = VideoCallSession.objects.create(
			patient_id='patient-1',
			doctor_id='doctor-1',
			room_name='room-1',
		)

		response = self.client.patch(
			f'/api/video-sessions/{session.id}/',
			{'status': 'not-a-status'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('status', response.data)


class HealthApiTests(APITestCase):
	def test_health_reports_ok(self):
		response = self.client.get('/api/health/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.json()['status'], 'ok')

	def test_health_reports_the_reason_the_model_is_unavailable(self):
		# A deploy that cannot import the inference stack must say why, because
		# the health endpoint is the only diagnostic reachable from outside.
		with patch.dict(sys.modules, {'emotion_model': None}):
			response = self.client.get('/api/health/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(
			response.json()['emotion_model'].startswith('unavailable: '))
		self.assertIn('emotion_model', response.json()['emotion_model'])

	def test_health_rejects_a_partially_initialized_model(self):
		# The startup race that broke live scans looked importable but had no
		# attributes yet; health must not describe that state as 'ok'.
		partial = ModuleType('emotion_model')

		with patch.dict(sys.modules, {'emotion_model': partial}):
			response = self.client.get('/api/health/')

		self.assertEqual(response.json()['emotion_model'],
						 'partially initialized')

	def test_health_reports_warmup_progress(self):
		response = self.client.get('/api/health/')

		# Warm-up is skipped under `manage.py test`, so only its presence and
		# shape can be asserted here.
		self.assertIsInstance(response.json()['warmup'], str)
		self.assertTrue(response.json()['warmup'])


class PredictEmotionApiTests(APITestCase):
	def test_missing_image_returns_400_without_loading_the_model(self):
		# Even with inference dependencies unavailable, a malformed request is
		# the caller's error (400), not a service failure (503).
		with patch.dict(sys.modules, {'emotion_model': None}):
			response = self.client.post('/api/predict-emotion/', {}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('image', response.data['detail'])

	def test_invalid_base64_returns_400(self):
		response = self.client.post(
			'/api/predict-emotion/', {'image': 'not-valid-base64!!!'}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Invalid base64', response.data['detail'])

	def test_invalid_sad_bias_returns_400(self):
		payload = base64.b64encode(b'fake-image').decode('ascii')

		response = self.client.post(
			'/api/predict-emotion/',
			{'image': payload, 'sad_bias': 'not-a-number'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('sad_bias', response.data['detail'])

	def test_multipart_upload_returns_prediction(self):
		image = SimpleUploadedFile('face.jpg', b'fake-jpeg-bytes',
			content_type='image/jpeg')
		model = fake_emotion_model()

		with patch.dict(sys.modules, {'emotion_model': model}):
			response = self.client.post(
				'/api/predict-emotion/', {'image': image}, format='multipart')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['label'], 'Neutral')
		self.assertEqual(response.data['probabilities'], PREDICTION['probabilities'])
		model.predict_image.assert_called_once_with(b'fake-jpeg-bytes', sad_bias=None)

	def test_json_base64_data_url_returns_prediction(self):
		payload = 'data:image/jpeg;base64,' + base64.b64encode(
			b'fake-jpeg-bytes').decode('ascii')
		model = fake_emotion_model()

		with patch.dict(sys.modules, {'emotion_model': model}):
			response = self.client.post(
				'/api/predict-emotion/',
				{'image': payload, 'sad_bias': 1.5},
				format='json',
			)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['runner_up']['label'], 'Happy')
		model.predict_image.assert_called_once_with(b'fake-jpeg-bytes', sad_bias=1.5)

	def test_no_face_returns_400(self):
		payload = base64.b64encode(b'fake-jpeg-bytes').decode('ascii')
		model = fake_emotion_model(result=None)

		with patch.dict(sys.modules, {'emotion_model': model}):
			response = self.client.post(
				'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('No face', response.data['detail'])

	def test_model_unavailable_returns_503(self):
		payload = base64.b64encode(b'fake-jpeg-bytes').decode('ascii')

		with patch.dict(sys.modules, {'emotion_model': None}):
			response = self.client.post(
				'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
		self.assertIn('unavailable', response.data['detail'])

	def test_prediction_timeout_returns_503(self):
		# Landmark detection has its own deadline (emotion_model), so a stalled
		# model must answer 503 instead of waiting for the gunicorn timeout.
		payload = base64.b64encode(b'fake-jpeg-bytes').decode('ascii')
		model = fake_emotion_model(
			side_effect=TimeoutError('Face landmark detection timed out'))

		with patch.dict(sys.modules, {'emotion_model': model}):
			response = self.client.post(
				'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
		self.assertIn('took too long', response.data['detail'])

	def test_prediction_value_error_returns_400(self):
		payload = base64.b64encode(b'fake-jpeg-bytes').decode('ascii')
		model = fake_emotion_model(side_effect=ValueError('Unreadable image'))

		with patch.dict(sys.modules, {'emotion_model': model}):
			response = self.client.post(
				'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Unreadable image', response.data['detail'])

	def test_unexpected_prediction_error_returns_500(self):
		payload = base64.b64encode(b'fake-jpeg-bytes').decode('ascii')
		model = fake_emotion_model(side_effect=RuntimeError('model crashed'))

		with patch.dict(sys.modules, {'emotion_model': model}):
			response = self.client.post(
				'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
		self.assertEqual(response.data['detail'], 'Prediction failed.')
