"""Final hybrid emotion model (73.91% fused test set) — portable inference package."""

from .predict_emotion import (
    DetectionTimeoutError,
    EmotionPredictor,
    get_predictor,
    predict_image,
)

__all__ = [
    "DetectionTimeoutError",
    "EmotionPredictor",
    "get_predictor",
    "predict_image",
]
