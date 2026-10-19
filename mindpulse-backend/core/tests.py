import base64
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import VideoCallSession

FACE_FIXTURE = Path(__file__).resolve().parent / 'test_fixtures' / 'face.jpg'


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


class PredictEmotionApiTests(APITestCase):
	def test_missing_image_returns_400(self):
		response = self.client.post('/api/predict-emotion/', {}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('image', response.data['detail'])

	def test_invalid_base64_returns_400(self):
		response = self.client.post(
			'/api/predict-emotion/', {'image': 'not-valid-base64!!!'}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('Invalid base64', response.data['detail'])

	def test_no_face_returns_400(self):
		import cv2
		import numpy as np

		_, buf = cv2.imencode('.jpg', np.zeros((128, 128, 3), dtype=np.uint8))
		payload = base64.b64encode(buf.tobytes()).decode('ascii')

		response = self.client.post(
			'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('No face', response.data['detail'])

	def test_multipart_upload_returns_prediction(self):
		image = SimpleUploadedFile('face.jpg', FACE_FIXTURE.read_bytes(),
			content_type='image/jpeg')

		response = self.client.post(
			'/api/predict-emotion/', {'image': image}, format='multipart')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn(response.data['label'], ('Happy', 'Neutral', 'Sad'))
		self.assertAlmostEqual(
			sum(response.data['probabilities'].values()), 1.0, places=5)
		self.assertGreater(response.data['confidence'], 0.0)

	def test_json_base64_data_url_returns_prediction(self):
		payload = 'data:image/jpeg;base64,' + base64.b64encode(
			FACE_FIXTURE.read_bytes()).decode('ascii')

		response = self.client.post(
			'/api/predict-emotion/', {'image': payload}, format='json')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn(response.data['label'], ('Happy', 'Neutral', 'Sad'))
		self.assertGreater(response.data['confidence'], 0.0)
