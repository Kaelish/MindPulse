from django.db import models


class VideoCallSession(models.Model):
	class Status(models.TextChoices):
		PENDING = 'pending', 'Pending'
		ACTIVE = 'active', 'Active'
		ENDED = 'ended', 'Ended'

	appointment_id = models.CharField(max_length=100, blank=True)
	patient_id = models.CharField(max_length=100)
	doctor_id = models.CharField(max_length=100)
	room_name = models.CharField(max_length=255, unique=True)
	meeting_url = models.URLField(max_length=500, blank=True)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	started_at = models.DateTimeField(null=True, blank=True)
	ended_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ('-created_at',)

	def __str__(self):
		return f'{self.room_name} ({self.status})'
