from __future__ import annotations

import cv2
import numpy as np


def decode_image(file_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(file_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image")
    return image


def preprocess_image(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    threshold = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        25,
        7,
    )
    kernel = np.ones((3, 3), np.uint8)
    threshold = cv2.morphologyEx(threshold, cv2.MORPH_CLOSE, kernel, iterations=1)
    return gray, threshold


def find_content_bounds(threshold: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(threshold > 0)
    if len(xs) == 0 or len(ys) == 0:
        return 0, 0, threshold.shape[1], threshold.shape[0]
    return int(xs.min()), int(ys.min()), int(xs.max() - xs.min()), int(ys.max() - ys.min())
