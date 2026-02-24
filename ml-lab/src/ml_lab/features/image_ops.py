from __future__ import annotations

import io
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def load_rgb_image(path: str | Path, image_size: tuple[int, int]) -> np.ndarray:
    p = Path(path)
    raw = p.read_bytes()
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        with Image.open(io.BytesIO(raw)) as pil:
            pil = pil.convert("RGB")
            pil = pil.resize((image_size[1], image_size[0]), Image.Resampling.BILINEAR)
            return np.array(pil, dtype=np.uint8)

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = cv2.resize(image, (image_size[1], image_size[0]), interpolation=cv2.INTER_AREA)
    return image


def decode_image_bytes(file_bytes: bytes, image_size: tuple[int, int]) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        with Image.open(io.BytesIO(file_bytes)) as pil:
            pil = pil.convert("RGB")
            pil = pil.resize((image_size[1], image_size[0]), Image.Resampling.BILINEAR)
            return np.array(pil, dtype=np.uint8)

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = cv2.resize(image, (image_size[1], image_size[0]), interpolation=cv2.INTER_AREA)
    return image
