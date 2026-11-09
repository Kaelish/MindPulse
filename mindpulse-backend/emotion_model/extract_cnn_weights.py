#!/usr/bin/env python3
"""
Export the numeric parameters needed for inference into a single NumPy .npz.

The saved pixel branch is Flatten -> Dense(512) -> BN -> Dense(256) -> BN ->
Dense(128) -> BN -> Dense(64) -> BN (dropout is a no-op at inference), the
standardiser is a StandardScaler, and the head is a multinomial
LogisticRegression. All three can be evaluated with NumPy, so the deployment
does not need TensorFlow, Keras, scikit-learn, or joblib.

Re-run this script only when the original model artifacts change. It requires
the development dependencies:
    python -m pip install h5py scikit-learn joblib
    python mindpulse-backend/emotion_model/extract_cnn_weights.py
"""

import os

import h5py
import joblib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
H5_SOURCE = os.path.join(HERE, "hybrid_improved_cnn_model.h5")
TARGET = os.path.join(HERE, "hybrid_improved_inference.npz")

DENSE_LAYERS = ("cnn_dense_512", "cnn_dense_256", "cnn_dense_128", "cnn_dense_64")
BN_LAYERS = ("cnn_bn_512", "cnn_bn_256", "cnn_bn_128", "cnn_bn_64")


def main():
    weights = {}
    with h5py.File(H5_SOURCE, "r") as model:
        for layer in DENSE_LAYERS:
            group = model["model_weights/%s/%s" % (layer, layer)]
            weights[layer + "_kernel"] = group["kernel"][()]
            weights[layer + "_bias"] = group["bias"][()]
        for layer in BN_LAYERS:
            group = model["model_weights/%s/%s" % (layer, layer)]
            for name in ("gamma", "beta", "moving_mean", "moving_variance"):
                weights[layer + "_" + name] = group[name][()]

    scaler = joblib.load(os.path.join(HERE, "hybrid_improved_scaler.joblib"))
    classifier = joblib.load(
        os.path.join(HERE, "hybrid_improved_multinomial_lr.joblib"))
    encoder = joblib.load(
        os.path.join(HERE, "hybrid_improved_encoder.joblib"))

    weights["scaler_mean"] = scaler.mean_
    weights["scaler_scale"] = scaler.scale_
    weights["lr_coef"] = classifier.coef_
    weights["lr_intercept"] = classifier.intercept_
    weights["lr_classes"] = classifier.classes_
    weights["class_names"] = np.array(
        [encoder["classes"][int(label)] for label in classifier.classes_])

    np.savez_compressed(TARGET, **weights)
    print("Wrote %s (%d arrays, %.1f MB)" % (
        TARGET, len(weights), os.path.getsize(TARGET) / (1024 * 1024)))


if __name__ == "__main__":
    main()
