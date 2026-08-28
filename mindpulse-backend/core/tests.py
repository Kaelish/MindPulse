from rest_framework import status
from rest_framework.test import APITestCase

from .models import VideoCallSession


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
