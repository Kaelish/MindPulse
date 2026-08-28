from rest_framework import serializers

from .models import VideoCallSession


class VideoCallSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoCallSession
        fields = (
            'id',
            'appointment_id',
            'patient_id',
            'doctor_id',
            'room_name',
            'meeting_url',
            'status',
            'started_at',
            'ended_at',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class VideoCallStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoCallSession
        fields = ('status',)