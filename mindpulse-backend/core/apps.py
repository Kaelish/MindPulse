import logging
import os
import sys
import threading
import traceback

from django.apps import AppConfig

logger = logging.getLogger(__name__)
# Django's default logging only routes the 'django' logger to the console,
# so attach a handler for this module's warm-up messages.
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

# Management commands where loading the emotion model would be wasted work.
_SKIP_WARMUP_COMMANDS = {
    'makemigrations', 'migrate', 'test', 'shell', 'createsuperuser',
    'collectstatic', 'flush', 'check', 'showmigrations', 'makemessages',
    'compilemessages', 'diffsettings', 'loaddata', 'dumpdata',
}

# Warm-up progress, reported by /api/health/. On a deployment without log
# access this is how a broken scan shows why it is broken.
WARMUP_STATE = {'status': 'not started', 'detail': None}
_warmup_lock = threading.Lock()
_warmup_pid = None


def _set_state(status, detail=None):
    WARMUP_STATE['status'] = status
    WARMUP_STATE['detail'] = detail


def _warm_emotion_model(get_predictor):
    """Build the graph and run one real prediction, on a background thread.

    `get_predictor` is passed in so this thread never has to import
    `emotion_model`; see the comment in `ready()`.
    """
    _set_state('running')
    try:
        get_predictor().warmup()
    except Exception as exc:
        _set_state('failed', '%s: %s' % (type(exc).__name__, exc))
        # Full traceback: a warm-up failure means every scan request will fail,
        # and the Render log is the only place this is visible.
        logger.error('Emotion model warm-up failed\n%s',
                     traceback.format_exc())
    else:
        _set_state('ok')
        logger.info('Emotion model warmed up and ready for requests.')


def ensure_warmup():
    """Start warm-up in *this* process, once, without blocking.

    Gunicorn loads the app in the master and then forks its workers, so a
    thread started by ready() does not exist in the process that actually
    serves requests - the worker inherited WARMUP_STATE ('running') but no
    warm-up thread, and MediaPipe was never imported. Tracking the pid means
    whichever process handles the first request starts the warm-up itself.
    """
    global _warmup_pid
    pid = os.getpid()
    with _warmup_lock:
        if _warmup_pid == pid:
            return
        _warmup_pid = pid
        try:
            from emotion_model import get_predictor
        except Exception as exc:
            _set_state('failed', '%s: %s' % (type(exc).__name__, exc))
            logger.error(
                'Emotion model could not be imported; scan requests will fail\n%s',
                traceback.format_exc())
            return
        # A forked child inherits the parent's predictor object but not the
        # detector thread, so a warm-up must run here too (warmup() rebuilds
        # the graph in this process; see _get_worker's pid check).
        _set_state('starting')
        threading.Thread(
            target=_warm_emotion_model, args=(get_predictor,),
            name='emotion-warmup', daemon=True).start()


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # With the reloader, ready() runs twice (parent + child); only the
        # child (RUN_MAIN=true) should import. With --noreload there is no
        # child. Non-server commands are skipped via the set above.
        if ('runserver' in sys.argv and '--noreload' not in sys.argv
                and os.environ.get('RUN_MAIN') != 'true'):
            return
        if _SKIP_WARMUP_COMMANDS.intersection(sys.argv):
            return
        # Import emotion_model here, in the main thread, before the worker
        # accepts connections. It is cheap (cv2 + numpy + a 1 MB .npz), and
        # importing it anywhere else is what broke live scans: the warm-up
        # thread used to do it first, so a request that arrived mid-import saw
        #   ImportError: cannot import name 'predict_image' from partially
        #   initialized module 'emotion_model'
        # and answered "Emotion model unavailable" to every scan. `ready()` is
        # called from django.setup(), which completes before a single request
        # is served, so a fully initialized module is guaranteed.
        #
        # MediaPipe is deliberately *not* imported here: it takes seconds even
        # on a fast CPU and would delay the worker from serving at all.
        try:
            import emotion_model
            if not hasattr(emotion_model, 'predict_image'):
                # A module that exists but is missing its exports can never
                # serve a scan; fail loudly at boot instead of at request time.
                raise ImportError(
                    'emotion_model imported without predict_image')
        except Exception as exc:
            _set_state('failed', '%s: %s' % (type(exc).__name__, exc))
            logger.error(
                'Emotion model could not be imported; scan requests will fail\n%s',
                traceback.format_exc())
            return
        # Warm-up is deliberately *not* started here: gunicorn loads the app in
        # its master and then forks its worker, so a thread started here would
        # build a MediaPipe graph in a process that never serves a scan - on a
        # 0.1 vCPU / 512 MB instance that is double the work and double the
        # memory. ensure_warmup() runs in whichever process handles the first
        # request (/api/health/ is polled immediately after deploy).
