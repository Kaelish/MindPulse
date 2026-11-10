import logging
import os
import sys
import threading

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


def _warm_emotion_model():
    """Load the hybrid emotion model once, in the background, at server start."""
    try:
        from emotion_model import get_predictor
        get_predictor().warmup()
        logger.info('Emotion model warmed up and ready for requests.')
    except Exception:
        # Full traceback: a warm-up failure means every scan request will fail,
        # and the Render log is the only place this is visible.
        logger.error('Emotion model warm-up failed', exc_info=True)


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
        threading.Thread(target=_warm_emotion_model, daemon=True).start()
