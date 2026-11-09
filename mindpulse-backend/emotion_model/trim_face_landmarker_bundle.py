"""Rebuild `face_landmarker.task` without the blendshape model.

The 478-landmark pipeline never asks MediaPipe for blendshapes, but the stock
`.task` bundle still ships `face_blendshapes.tflite`. MediaPipe always builds a
blendshape subgraph for it and hard-codes that subgraph to the XNNPACK delegate,
which spawns one spinning thread per visible CPU. On a container limited to a
fraction of a core those threads eat the CPU quota, so dropping the unused model
keeps the graph fully single-threaded (and 955 KB smaller).

Usage:
    python emotion_model/trim_face_landmarker_bundle.py [source.task] [target.task]

The landmark detector and the geometry metadata are copied byte-for-byte, so
the produced landmarks are identical to the original bundle.
"""

import os
import shutil
import sys

import zipfile

KEEP = (
    'face_detector.tflite',
    'face_landmarks_detector.tflite',
    'geometry_pipeline_metadata_landmarks.binarypb',
)

HERE = os.path.dirname(os.path.abspath(__file__))


def main(source, target):
    with zipfile.ZipFile(source) as src:
        missing = [name for name in KEEP
                   if name not in src.namelist()]
        if missing:
            raise SystemExit('Source bundle is missing: %s' % ', '.join(missing))
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as dst:
            for info in src.infolist():
                if info.filename in KEEP:
                    dst.writestr(info, src.read(info.filename))

    before = os.path.getsize(source)
    after = os.path.getsize(target)
    print('Wrote %s (%d bytes, was %d)' % (target, after, before))


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'face_landmarker.task')
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'face_landmarker.task')
    if not os.path.exists(src):
        raise SystemExit('Not found: %s' % src)
    if os.path.abspath(src) == os.path.abspath(dst):
        backup = src + '.full'
        shutil.copyfile(src, backup)
        print('Original kept at %s' % backup)
    main(src, dst)
