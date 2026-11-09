#!/usr/bin/env python3
"""
Standalone inference for the final hybrid emotion model (73.91% fused test set,
72.83% +/- 0.65% 5-fold CV). Transferred from the capstone project on 2026-10-03.

Usage:
    from emotion_model import predict_image
    result = predict_image("path/to/face.jpg")
    # {"label": "Happy", "confidence": 0.87, "probabilities": {...}, ...}

Or reuse one loaded instance across requests:
    from emotion_model import get_predictor
    result = get_predictor().predict(image_bytes)

Artifacts expected in this folder:
    hybrid_improved_inference.npz         Pixel branch + scaler + classifier
                                          weights (extracted from the original
                                          Keras/scikit-learn artifacts)
    face_landmarker.task                  MediaPipe FaceLandmarker (478 landmarks)
    landmark_utils.py                     nose-tip/inter-ocular normalization

Pipeline (identical to the capstone camera validation):
    1. MediaPipe FaceLandmarker -> 478x3 raw coords
    2. normalize_landmarks (center=nose tip lm1, scale=eye dist lm33<->lm263)
    3. face crop (bbox + 25% pad) -> grayscale -> 64x64 -> /255 -> dense branch
    4. concat [64-d emb | 1434 lm] -> standardise -> multinomial logistic
       regression -> softmax

The saved pixel branch is a small multi-layer perceptron (Flatten -> Dense
512/256/128/64), and the classifier is a standard scaler + logistic regression.
Both are evaluated with NumPy instead of TensorFlow/scikit-learn, which keeps
the Render free instance under its memory limit and avoids cross-version pickle
incompatibilities. The original model files are retained for provenance.
"""

import os
import threading

import cv2
import numpy as np

try:  # works as a package (emotion_model.predict_emotion) or a flat script
    from .landmark_utils import normalize_landmarks
except ImportError:  # pragma: no cover
    from landmark_utils import normalize_landmarks

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_SIZE = 64
BN_EPSILON = 1e-3  # matches BatchNormalization(epsilon=0.001) in the saved model

_DENSE_BLOCKS = (
    ("cnn_dense_512", "cnn_bn_512", 512),
    ("cnn_dense_256", "cnn_bn_256", 256),
    ("cnn_dense_128", "cnn_bn_128", 128),
    ("cnn_dense_64", "cnn_bn_64", 64),
)

_predictor = None  # module-level singleton
_predictor_lock = threading.Lock()


def crop_face(frame, coords):
    """Crop the padded face bbox (raw MediaPipe coords in [0,1]) from the frame."""
    h, w = frame.shape[:2]
    xs, ys = coords[:, 0], coords[:, 1]
    x0, x1 = float(xs.min()), float(xs.max())
    y0, y1 = float(ys.min()), float(ys.max())
    pad_x = (x1 - x0) * 0.25
    pad_y = (y1 - y0) * 0.25
    x0, x1 = x0 - pad_x, x1 + pad_x
    y0, y1 = y0 - pad_y, y1 + pad_y
    px0 = max(0, int(x0 * w))
    px1 = min(w, int(x1 * w) + 1)
    py0 = max(0, int(y0 * h))
    py1 = min(h, int(y1 * h) + 1)
    if px1 - px0 < 8 or py1 - py0 < 8:
        return frame
    return frame[py0:py1, px0:px1]


class EmotionPredictor:
    """Loads the numeric artifacts once and predicts on images."""

    def __init__(self, model_dir=MODEL_DIR, image_size=IMAGE_SIZE,
                 sad_bias=0.0, num_faces=1, weights_path=None):
        self.image_size = image_size
        self.sad_bias = float(sad_bias)
        self._landmarker = None
        self._num_faces = num_faces

        weights_path = weights_path or os.path.join(
            model_dir, "hybrid_improved_inference.npz")
        if not os.path.exists(weights_path):
            raise FileNotFoundError(
                "Inference weights not found: %s. Generate the file with "
                "emotion_model/extract_cnn_weights.py." % weights_path)

        with np.load(weights_path) as weights:
            self._dense_blocks = []
            for dense_name, bn_name, units in _DENSE_BLOCKS:
                kernel = np.ascontiguousarray(
                    weights[dense_name + "_kernel"], dtype=np.float32)
                bias = np.ascontiguousarray(
                    weights[dense_name + "_bias"], dtype=np.float32)
                gamma = np.ascontiguousarray(
                    weights[bn_name + "_gamma"], dtype=np.float32)
                beta = np.ascontiguousarray(
                    weights[bn_name + "_beta"], dtype=np.float32)
                mean = np.ascontiguousarray(
                    weights[bn_name + "_moving_mean"], dtype=np.float32)
                variance = np.ascontiguousarray(
                    weights[bn_name + "_moving_variance"], dtype=np.float32)
                if kernel.shape != (kernel.shape[0], units):
                    raise ValueError(
                        "Unexpected %s kernel shape %r" % (dense_name, kernel.shape))
                # Fold BatchNormalization into a single scale/offset per unit.
                scale = gamma / np.sqrt(variance + BN_EPSILON)
                self._dense_blocks.append(
                    (kernel, bias, scale, beta - mean * scale))

            self._scaler_mean = np.asarray(
                weights["scaler_mean"], dtype=np.float64)
            self._scaler_scale = np.asarray(
                weights["scaler_scale"], dtype=np.float64)
            self._lr_coef = np.asarray(weights["lr_coef"], dtype=np.float64)
            self._lr_intercept = np.asarray(
                weights["lr_intercept"], dtype=np.float64)
            self._lr_classes = np.asarray(weights["lr_classes"], dtype=np.int64)
            names = weights["class_names"]
            self.class_names = [str(name) for name in names]

        if len(self.class_names) != len(self._lr_classes):
            raise ValueError(
                "class_names and lr_classes must have the same length")

        self._landmarker_path = os.path.join(model_dir, "face_landmarker.task")

    def _get_landmarker(self):
        if self._landmarker is None:
            import mediapipe as mp
            self._landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(
                mp.tasks.vision.FaceLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(
                        model_asset_path=self._landmarker_path),
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_faces=self._num_faces,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                )
            )
        return self._landmarker

    def _embed_pixels(self, pixels):
        """Dense pixel branch: Flatten -> (Dense -> ReLU -> BN) x4."""
        x = np.asarray(pixels, dtype=np.float32).reshape(-1)
        for kernel, bias, scale, offset in self._dense_blocks:
            x = x @ kernel
            x += bias
            np.maximum(x, 0, out=x)
            x *= scale
            x += offset
        return x

    @staticmethod
    def _load_bgr(image):
        """Accept a file path, raw bytes, or a numpy array (BGR or RGB)."""
        if isinstance(image, (str, os.PathLike)):
            frame = cv2.imread(str(image))
            if frame is None:
                raise ValueError("Could not read image: %s" % image)
            return frame
        if isinstance(image, (bytes, bytearray)):
            arr = np.frombuffer(bytes(image), dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("Could not decode image bytes")
            return frame
        if isinstance(image, np.ndarray):
            if image.ndim == 2:  # already grayscale -> to BGR
                return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            if image.shape[2] == 4:  # RGBA/ BGRA
                return image[:, :, :3]
            return image
        raise TypeError("Unsupported image type: %r" % type(image))

    def predict(self, image, sad_bias=None):
        """Run the full pipeline. Returns a dict, or None when no face is found."""
        import mediapipe as mp

        frame = self._load_bgr(image)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._get_landmarker().detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        if not results.face_landmarks:
            return None

        coords = np.array([[p.x, p.y, p.z] for p in results.face_landmarks[0]],
                          dtype=np.float64)
        norm = normalize_landmarks(coords)
        if norm is None:
            return None

        # Pixel-branch input
        face = crop_face(frame, coords)
        gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (self.image_size, self.image_size))
        pixels = gray.astype(np.float32) / 255.0

        embedding = self._embed_pixels(pixels).astype(np.float64, copy=False)
        fused = np.concatenate([embedding, norm.reshape(-1)])

        # StandardScaler + multinomial LogisticRegression, evaluated directly.
        scaled = (fused - self._scaler_mean) / self._scaler_scale
        logits = self._lr_coef @ scaled + self._lr_intercept
        logits -= logits.max()
        probs = np.exp(logits)
        probs /= probs.sum()

        bias = self.sad_bias if sad_bias is None else float(sad_bias)
        if bias > 0 and "Sad" in self.class_names:
            sad_idx = self.class_names.index("Sad")
            probs = probs.copy()
            probs[sad_idx] += bias
            probs /= probs.sum()

        top = int(np.argmax(probs))
        ranked = np.argsort(probs)[::-1]
        runner = int(ranked[1]) if len(ranked) > 1 else None
        return {
            "label": self.class_names[top],
            "confidence": float(probs[top]),
            "probabilities": {
                name: float(p) for name, p in zip(self.class_names, probs)},
            "runner_up": ({
                "label": self.class_names[runner],
                "confidence": float(probs[runner]),
            } if runner is not None else None),
            "has_face": True,
        }

    def warmup(self):
        """Create the lazily-initialized landmarker so the first real request
        does not pay its ~0.5s cost."""
        self._get_landmarker()
        return self

    def close(self):
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None


def get_predictor(**kwargs):
    """Shared predictor instance (loads the model once per process)."""
    global _predictor
    if _predictor is None:
        with _predictor_lock:
            if _predictor is None:
                _predictor = EmotionPredictor(**kwargs)
    return _predictor


def predict_image(image, **kwargs):
    """One-shot helper: load-free prediction using the shared instance."""
    return get_predictor().predict(image, **kwargs)
