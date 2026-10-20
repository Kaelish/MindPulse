from django.urls import path

from .views import (
    VideoCallSessionDetailView,
    VideoCallSessionListCreateView,
    predict_emotion_view,
)

urlpatterns = [
    path('video-sessions/', VideoCallSessionListCreateView.as_view(), name='video-session-list-create'),
    path('video-sessions/<int:pk>/', VideoCallSessionDetailView.as_view(), name='video-session-detail'),
    path('predict-emotion/', predict_emotion_view, name='predict-emotion'),
]