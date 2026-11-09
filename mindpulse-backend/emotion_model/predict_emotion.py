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
    face_landmarker.task                  MediaPipe FaceLandmarker (478 landmarks).
                                          The blendshape model was removed from
                                          the bundle because it is never used.
    landmark_utils.py                     nose-tip/inter-ocular normalization
    warmup_face.jpg                       Tiny face used to prime the first
                                          inference at server start

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

Runtime notes (important on small shared-CPU hosts such as Render's free plan):
    * The landmarker is created and used from one dedicated worker thread, so
      the MediaPipe graph never has to be shared between threads.
    * XNNPACK is pinned to a single thread through the acceleration proto
      (`Acceleration.xnnpack.num_threads`). By default MediaPipe spawns one
      spinning worker per visible CPU; inside a container limited to a fraction
      of a core those workers burn the whole CPU quota and a 20 ms detection can
      stretch into minutes. One thread produces bit-identical results.
    * OpenCV's own worker pool is disabled for the same reason.
    * Detection runs under a deadline (`MINDPULSE_DETECT_TIMEOUT_S`, 60 s by
      default) so a stuck graph returns a 503 instead of the web worker being
      killed by the gunicorn timeout.
"""

import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError

import cv2
import numpy as np

try:  # works as a package (emotion_model.predict_emotion) or a flat script
    from .landmark_utils import normalize_landmarks
except ImportError:  # pragma: no cover
    from landmark_utils import normalize_landmarks

# A single-threaded pipeline is both faster and far more predictable when the
# process only owns a fraction of a CPU core.
cv2.setNumThreads(1)

logger = logging.getLogger(__name__)
# Django's default logging only routes the 'django' logger to the console, so
# attach a handler for the per-request timing lines (same pattern as core.apps).
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_SIZE = 64
BN_EPSILON = 1e-3  # matches BatchNormalization(epsilon=0.001) in the saved model

# Phone cameras produce 12 MP frames; keeping the long side at 1024 px bounds
# the decode/copy cost without affecting the 64x64 pixel branch.
MAX_INPUT_SIDE = int(os.environ.get('MINDPULSE_MAX_INPUT_SIDE', '1024'))
DETECT_TIMEOUT_S = float(os.environ.get('MINDPULSE_DETECT_TIMEOUT_S', '60'))
# Number of XNNPACK worker threads. One is deliberate: see the module docstring.
XNNPACK_THREADS = max(1, int(os.environ.get('MINDPULSE_XNNPACK_THREADS', '1')))

_DENSE_BLOCKS = (
    ("cnn_dense_512", "cnn_bn_512", 512),
    ("cnn_dense_256", "cnn_bn_256", 256),
    ("cnn_dense_128", "cnn_bn_128", 128),
    ("cnn_dense_64", "cnn_bn_64", 64),
)

_predictor = None  # module-level singleton
_predictor_lock = threading.Lock()

# One worker: MediaPipe graphs are not designed for concurrent use, and this
# serialises detection without holding locks across the C++ call.
_detect_pool = None
_detect_pool_pid = None
_detect_pool_lock = threading.Lock()


class DetectionTimeoutError(TimeoutError):
    """Raised when face landmark detection exceeds DETECT_TIMEOUT_S."""


def _get_detect_pool():
    """Lazily create the detector thread, once per process (fork-safe)."""
    global _detect_pool, _detect_pool_pid
    pid = os.getpid()
    if _detect_pool is None or _detect_pool_pid != pid:
        with _detect_pool_lock:
            if _detect_pool is None or _detect_pool_pid != pid:
                _detect_pool = ThreadPoolExecutor(
                    max_workers=1, thread_name_prefix='emotion-detect')
                _detect_pool_pid = pid
    return _detect_pool


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


def _pinned_base_options(mp, model_path):
    """`mp.tasks.BaseOptions` that caps MediaPipe's XNNPACK thread pool.

    MediaPipe sizes the XNNPACK pool from the number of visible CPUs. Inside a
    container that is limited to a fraction of a core, every extra worker spins
    for CPU it is not allowed to use, and per-operator barriers end up costing
    whole CFS periods. The acceleration proto is the only supported way to cap
    it, and single-threaded results are bit-identical.
    """
    def pin(proto):
        proto.acceleration.xnnpack.num_threads = XNNPACK_THREADS
        return proto

    try:
        class _PinnedBaseOptions(mp.tasks.BaseOptions):
            def to_pb2(self):
                return pin(super().to_pb2())

        return _PinnedBaseOptions(model_asset_path=model_path)
    except Exception:  # pragma: no cover - defensive for other versions
        logger.warning('Could not pin XNNPACK threads; using MediaPipe defaults')
        return mp.tasks.BaseOptions(model_asset_path=model_path)


class EmotionPredictor:
    """Loads the numeric artifacts once and predicts on images."""

    def __init__(self, model_dir=MODEL_DIR, image_size=IMAGE_SIZE,
                 sad_bias=0.0, num_faces=1, weights_path=None,
                 detect_timeout=DETECT_TIMEOUT_S, max_input_side=MAX_INPUT_SIDE):
        self.image_size = image_size
        self.sad_bias = float(sad_bias)
        self.detect_timeout = float(detect_timeout)
        self.max_input_side = int(max_input_side)
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
        """Create the MediaPipe graph on the detector thread (first use only)."""
        if self._landmarker is None:
            import mediapipe as mp
            self._landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(
                mp.tasks.vision.FaceLandmarkerOptions(
                    base_options=_pinned_base_options(
                        mp, self._landmarker_path),
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_faces=self._num_faces,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                )
            )
        return self._landmarker

    def _run_detect(self, rgb):
        """Runs on the detector thread: create/use the graph there only."""
        import mediapipe as mp
        landmarker = self._get_landmarker()
        return landmarker.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))

    def _detect_landmarks(self, rgb):
        """Run detection under a deadline so a stuck graph cannot wedge the
        web worker until gunicorn kills it."""
        future = _get_detect_pool().submit(self._run_detect, rgb)
        try:
            return future.result(timeout=self.detect_timeout)
        except FutureTimeoutError:
            logger.error(
                'Face landmark detection exceeded %.0fs; the detector thread '
                'is still busy.', self.detect_timeout)
            raise DetectionTimeoutError(
                'Face landmark detection timed out after %.0fs.'
                % self.detect_timeout)

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

    def _limit_size(self, frame):
        """Downscale very large camera frames to bound CPU and memory use."""
        h, w = frame.shape[:2]
        longest = max(h, w)
        if self.max_input_side <= 0 or longest <= self.max_input_side:
            return frame, False
        scale = float(self.max_input_side) / longest
        size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
        return cv2.resize(frame, size, interpolation=cv2.INTER_AREA), True

    def predict(self, image, sad_bias=None):
        """Run the full pipeline. Returns a dict, or None when no face is found."""
        started = time.perf_counter()
        frame = self._load_bgr(image)
        frame, resized = self._limit_size(frame)
        decoded = time.perf_counter()

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._detect_landmarks(rgb)
        detected = time.perf_counter()

        size_note = ' resized=%dx%d' % (frame.shape[1], frame.shape[0]) if resized else ''
        if not results.face_landmarks:
            logger.info(
                'predict: no face (decode %.0fms, detect %.0fms)%s',
                (decoded - started) * 1000, (detected - decoded) * 1000, size_note)
            return None

        coords = np.array([[p.x, p.y, p.z] for p in results.face_landmarks[0]],
                          dtype=np.float64)
        norm = normalize_landmarks(coords)
        if norm is None:
            logger.info(
                'predict: unusable landmarks (decode %.0fms, detect %.0fms)%s',
                (decoded - started) * 1000, (detected - decoded) * 1000, size_note)
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

        finished = time.perf_counter()
        logger.info(
            'predict: %s %.1f%% in %.0fms (decode %.0fms, detect %.0fms)%s',
            self.class_names[top], probs[top] * 100,
            (finished - started) * 1000, (decoded - started) * 1000,
            (detected - decoded) * 1000, size_note)

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
        """Create the landmarker on the detector thread and run one real
        prediction, so the first user request does not pay the graph and
        interpreter start-up cost. Also proves the pipeline works at boot."""
        started = time.perf_counter()
        self._get_landmarker_ready()
        sample = os.path.join(
            os.path.dirname(self._landmarker_path), "warmup_face.jpg")
        if os.path.exists(sample):
            with open(sample, 'rb') as handle:
                self.predict(handle.read())
        logger.info('Emotion model warmed up in %.1fs',
                    time.perf_counter() - started)
        return self

    def _get_landmarker_ready(self):
        """Block until the detector thread has built the graph."""
        future = _get_detect_pool().submit(self._get_landmarker)
        return future.result(timeout=self.detect_timeout)

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
