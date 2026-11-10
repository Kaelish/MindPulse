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


def _set_state(status, detail=None):
    WARMUP_STATE['status'] = status
    WARMUP_STATE['detail'] = detail


def _warm_emotion_model(get_predictor):
    """Load the hybrid emotion model once, in the background, at server start.

    `get_predictor` is passed in because `emotion_model` must only ever be
    imported by `ready()` (the main thread); see the comment there.
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


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # With the reloader, ready() runs twice (parent + child); only the
        # child (RUN_MAIN=true) should warm. With --noreload there is no child,
        # so warm directly. Non-server commands are skipped via the set above.
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
        # called from django.setup(), which gunicorn completes before it serves
        # a single request, so a fully initialized module is guaranteed.
        #
        # MediaPipe is deliberately *not* imported here: it takes seconds even
        # on a fast CPU and would delay the worker from serving at all. It is
        # imported by the warm-up thread, and its progress is reported by
        # /api/health/ as `warmup`.
        try:
            from emotion_model import get_predictor
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
        _set_state('imported')
        threading.Thread(
            target=_warm_emotion_model, args=(get_predictor,),
            name='emotion-warmup', daemon=True).start()
