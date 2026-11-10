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
    * The landmarker is created and used from one dedicated daemon thread, so
      the MediaPipe graph is never shared between threads and a graph that
      wedges inside C++ cannot keep the process from exiting.
    * MediaPipe sizes XNNPACK's pool from the number of *visible* CPUs, which
      says nothing about a container that is allowed a fraction of a core. The
      pool is therefore capped explicitly through the acceleration proto
      (`Acceleration.xnnpack.num_threads`, `MINDPULSE_XNNPACK_THREADS`).
    * OpenCV's own worker pool is disabled for the same reason.
    * Detection runs under a deadline (`MINDPULSE_DETECT_TIMEOUT_S`, 60 s by
      default). On expiry the worker thread is abandoned (a fresh graph is
      built for the next request) and the request answers 503 well before the
      gunicorn timeout kills the worker.
    * Every prediction logs decode/detect/overall timings, and the boot log
      reports the CPU and memory limits the process actually has, so a slow
      host can be diagnosed from the Render log alone.
"""

import logging
import os
import queue
import threading
import time

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

# The current detector worker (owns the MediaPipe graph and one daemon thread).
_worker = None
_worker_pid = None
_worker_lock = threading.Lock()


class DetectionTimeoutError(TimeoutError):
    """Raised when face landmark detection exceeds DETECT_TIMEOUT_S."""


class _DetectWorker:
    """One daemon thread that owns a MediaPipe face-landmarker graph.

    Keeping the graph thread-confined avoids sharing MediaPipe state between
    request threads. This is deliberately not a `ThreadPoolExecutor`: those
    worker threads are joined at interpreter exit, so a graph wedged inside C++
    would block shutdown too. A daemon thread can simply be abandoned
    (`MINDPULSE_DETECT_TIMEOUT_S`); the next request gets a fresh graph.
    """

    def __init__(self, model_path, num_faces):
        self._model_path = model_path
        self._num_faces = num_faces
        self._landmarker = None  # only touched from the worker thread
        self._jobs = queue.Queue()
        self._thread = None
        self._lock = threading.Lock()

    def _ensure_thread(self):
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(
                    target=self._loop, name='emotion-detect', daemon=True)
                self._thread.start()

    def _loop(self):
        while True:
            name, payload, box = self._jobs.get()
            try:
                if name == 'detect':
                    box['value'] = self._detect(payload)
                else:
                    box['value'] = self._ensure_landmarker()
            except Exception as exc:  # noqa: BLE001 - re-raised by the caller
                box['error'] = exc
            finally:
                box['done'].set()

    def call(self, name, payload, timeout):
        box = {'done': threading.Event()}
        self._ensure_thread()
        self._jobs.put((name, payload, box))
        if not box['done'].wait(timeout):
            raise DetectionTimeoutError(
                'Face landmark detection timed out after %.0fs.' % timeout)
        if 'error' in box:
            raise box['error']
        return box.get('value')

    def _ensure_landmarker(self):
        if self._landmarker is None:
            import mediapipe as mp
            base_options = _pinned_base_options(mp, self._model_path)
            self._landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(
                mp.tasks.vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_faces=self._num_faces,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                )
            )
        return self._landmarker

    def _detect(self, rgb):
        import mediapipe as mp
        landmarker = self._ensure_landmarker()
        return landmarker.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))


def _get_worker(model_path, num_faces):
    """Current detector worker for this process (a graph cannot be forked)."""
    global _worker, _worker_pid
    pid = os.getpid()
    with _worker_lock:
        if _worker is None or _worker_pid != pid:
            _worker = _DetectWorker(model_path, num_faces)
            _worker_pid = pid
        return _worker


def _abandon_worker(worker):
    """Drop `worker` so the next request builds a fresh thread and graph."""
    global _worker, _worker_pid
    with _worker_lock:
        if _worker is worker:
            _worker = None
            _worker_pid = None


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

    def _detect_landmarks(self, rgb):
        """Run detection on the dedicated worker under a deadline.

        On timeout the worker (and its graph) is abandoned so one bad request
        cannot wedge every later one; the next request starts a fresh graph.
        """
        worker = _get_worker(self._landmarker_path, self._num_faces)
        try:
            return worker.call('detect', rgb, self.detect_timeout)
        except DetectionTimeoutError:
            _abandon_worker(worker)
            logger.error(
                'Face landmark detection exceeded %.0fs; abandoned the '
                'detector thread and its graph.', self.detect_timeout)
            raise

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
    def _encoded_size(data):
        """Best-effort (width, height) parsed from a JPEG/PNG header.

        Phone captures are 12 MP and the pipeline only needs ~1024 px, so it is
        worth peeking at the header to pick a reduced-scale decode instead of
        allocating the full frame first.
        """
        if len(data) >= 24 and data[:8] == b'\x89PNG\r\n\x1a\n':
            return (int.from_bytes(data[16:20], 'big'),
                    int.from_bytes(data[20:24], 'big'))
        if len(data) < 4 or data[0] != 0xFF or data[1] != 0xD8:  # not JPEG
            return None
        index, total = 2, len(data)
        while index + 3 < total:
            if data[index] != 0xFF:
                index += 1
                continue
            marker = data[index + 1]
            if marker == 0xFF:  # fill byte
                index += 1
                continue
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:  # no payload
                index += 2
                continue
            if (0xC0 <= marker <= 0xCF
                    and marker not in (0xC4, 0xC8, 0xCC)):  # SOFn: has frame size
                if index + 9 > total:
                    return None
                height = int.from_bytes(data[index + 5:index + 7], 'big')
                width = int.from_bytes(data[index + 7:index + 9], 'big')
                return (width, height)
            length = int.from_bytes(data[index + 2:index + 4], 'big')
            if length < 2:
                return None
            index += 2 + length
        return None

    def _decode_flag(self, data):
        """Pick a reduced-scale decode for images far larger than we need."""
        if self.max_input_side <= 0:
            return cv2.IMREAD_COLOR
        size = self._encoded_size(data)
        if not size:
            return cv2.IMREAD_COLOR
        longest = max(size)
        if longest > 4 * self.max_input_side:
            return cv2.IMREAD_REDUCED_COLOR_4
        if longest > 2 * self.max_input_side:
            return cv2.IMREAD_REDUCED_COLOR_2
        return cv2.IMREAD_COLOR

    def _load_bgr(self, image):
        """Accept a file path, raw bytes, or a numpy array (BGR or RGB)."""
        if isinstance(image, (str, os.PathLike)):
            frame = cv2.imread(str(image))
            if frame is None:
                raise ValueError("Could not read image: %s" % image)
            return frame
        if isinstance(image, (bytes, bytearray)):
            data = bytes(image)
            arr = np.frombuffer(data, dtype=np.uint8)
            frame = cv2.imdecode(arr, self._decode_flag(data))
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
        loaded_size = (frame.shape[1], frame.shape[0])
        frame, resized = self._limit_size(frame)
        decoded = time.perf_counter()

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._detect_landmarks(rgb)
        detected = time.perf_counter()

        size_note = ' %dx%d' % loaded_size
        if resized:
            size_note += '->%dx%d' % (frame.shape[1], frame.shape[0])
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
        """Create the landmarker and run one real prediction, so the first user
        request does not pay the graph and interpreter start-up cost. Also
        proves the pipeline works at boot."""
        started = time.perf_counter()
        _log_host_limits()
        sample = os.path.join(
            os.path.dirname(self._landmarker_path), "warmup_face.jpg")
        if os.path.exists(sample):
            with open(sample, 'rb') as handle:
                self.predict(handle.read())
        else:  # still build the graph even without a sample image
            worker = _get_worker(self._landmarker_path, self._num_faces)
            worker.call('warmup', None, self.detect_timeout)
        logger.info('Emotion model warmed up in %.1fs',
                    time.perf_counter() - started)
        return self

    def close(self):
        """Drop the detector worker (its graph is closed with the thread)."""
        global _worker, _worker_pid
        with _worker_lock:
            worker, _worker, _worker_pid = _worker, None, None
        return worker


def _log_host_limits():
    """Log the CPU/memory limits this process is actually running under.

    Python and MediaPipe size their thread pools from `os.cpu_count()`, which
    inside a container is the host's CPU count - not the quota. When a request
    is mysteriously slow on a shared host, these numbers are the first thing
    worth knowing.
    """
    parts = ['cpus=%s' % os.cpu_count()]
    try:
        affinity = len(os.sched_getaffinity(0))  # Linux only
        parts.append('affinity=%d' % affinity)
    except (AttributeError, OSError):
        pass
    for label, path in (('cpu.max', '/sys/fs/cgroup/cpu.max'),
                        ('memory.max', '/sys/fs/cgroup/memory.max')):
        try:
            with open(path, 'r', encoding='ascii') as handle:
                parts.append('%s=%s' % (label, handle.read().strip()))
        except OSError:
            pass
    logger.info('Host limits: %s', ' '.join(parts))


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
