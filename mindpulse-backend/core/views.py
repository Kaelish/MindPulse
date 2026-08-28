from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status

from .models import VideoCallSession
from .serializers import VideoCallSessionSerializer, VideoCallStatusSerializer


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
