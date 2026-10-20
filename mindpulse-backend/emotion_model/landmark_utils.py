#!/usr/bin/env python3
"""
Shared landmark + label-mapping utilities for the fused-data pipeline.

The 3-class encoding used everywhere in this project is:
    0 = Happy, 1 = Neutral, 2 = Sad
"""

import numpy as np

LANDMARKS = 478


def feature_columns():
    """Return the 1434 column names for the raw/normalized landmark features."""
    cols = []
    for i in range(LANDMARKS):
        cols += [f"lm_{i}_x", f"lm_{i}_y", f"lm_{i}_z"]
    return cols


def normalize_landmarks(coords):
    """
    Position + scale normalization of the 478x3 landmark array.
    Center: nose tip (landmark 1). Scale: inter-ocular distance (lm 33 <-> lm 263).
    Returns None when the face is degenerate (eye distance ~0).
    """
    coords = np.asarray(coords, dtype=np.float64)
    if coords.shape != (LANDMARKS, 3):
        return None
    center = coords[1].copy()  # nose tip
    eye_dist = float(np.linalg.norm(coords[33, :2] - coords[263, :2]))
    if eye_dist < 1e-9:
        return None
    return (coords - center) / eye_dist


def landmarks_to_array(landmarks):
    """Convert a list of {x,y,z} records (MediaPipe output) into a 478x3 array."""
    return np.array(
        [[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float64
    )


# --------------------------------------------------------------------------- #
# Cross-dataset label mappings (source schema -> our {0,1,2} schema)          #
# --------------------------------------------------------------------------- #

# FER2013 (Jeneral/fer-2013 stores string labels). Mirrors the improvement
# plan's FER2013_EMOTION_MAP: angry/disgust/fear/sad->Sad, happy->Happy,
# surprise/neutral->Neutral.
FER_TARGET_MAP = {
    "angry": 2,
    "disgust": 2,
    "fear": 2,
    "happy": 0,
    "sad": 2,
    "surprise": 1,
    "neutral": 1,
}

# RAF-DB (7-class) -> our 3-class schema, using the same philosophy as FER2013.
RAF_TARGET_MAP = {
    "happiness": 0,
    "neutral": 1,
    "surprise": 1,
    "sadness": 2,
    "anger": 2,
    "disgust": 2,
    "fear": 2,
}

# mindpulse-capstone labels are STRESS/arousal levels, named by folder:
#     high (stress) = Sad (2), medium = Neutral (1), low (relaxed) = Happy (0).
# The HF auto-conversion assigns label ids alphabetically by folder name:
#     high -> 0, low -> 1, medium -> 2. Remap to our {0,1,2} emotion schema.
MINDPULSE_LABEL_MAP = {0: 2, 1: 0, 2: 1}

MINDPULSE_SOURCE = "mindpulse"
FER_SOURCE = "fer2013"
RAF_SOURCE = "rafdb"
ALL_SOURCES = [MINDPULSE_SOURCE, FER_SOURCE, RAF_SOURCE]