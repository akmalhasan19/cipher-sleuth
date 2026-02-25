from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def _base_image(rng: np.random.Generator, image_size: tuple[int, int]) -> np.ndarray:
    height, width = image_size
    gradient_x = np.tile(np.linspace(0, 255, width, dtype=np.float32), (height, 1))
    gradient_y = np.tile(np.linspace(0, 255, height, dtype=np.float32), (width, 1)).T
    noise = rng.normal(0, 8, size=(height, width)).astype(np.float32)

    ch_r = np.clip(0.6 * gradient_x + 0.4 * gradient_y + noise, 0, 255)
    ch_g = np.clip(0.35 * gradient_x + 0.65 * gradient_y + noise, 0, 255)
    ch_b = np.clip(0.75 * gradient_x + 0.25 * gradient_y + noise, 0, 255)
    image = np.stack([ch_r, ch_g, ch_b], axis=2).astype(np.uint8)

    for _ in range(4):
        center = (int(rng.integers(width // 8, width - width // 8)), int(rng.integers(height // 8, height - height // 8)))
        radius = int(rng.integers(max(8, width // 20), max(10, width // 8)))
        color = tuple(int(x) for x in rng.integers(40, 220, size=3))
        cv2.circle(image, center, radius, color, thickness=-1)

    return image


def _tamper_with_mask(image: np.ndarray, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    tampered = image.copy()
    height, width, _ = tampered.shape
    mask = np.zeros((height, width), dtype=np.uint8)

    patch_w = int(rng.integers(max(24, width // 10), max(28, width // 5)))
    patch_h = int(rng.integers(max(24, height // 10), max(28, height // 5)))

    sx = int(rng.integers(0, width - patch_w))
    sy = int(rng.integers(0, height - patch_h))
    tx = int(rng.integers(0, width - patch_w))
    ty = int(rng.integers(0, height - patch_h))

    patch = tampered[sy : sy + patch_h, sx : sx + patch_w].copy()
    if rng.random() > 0.5:
        patch = cv2.GaussianBlur(patch, (5, 5), sigmaX=1.2)
    if rng.random() > 0.5:
        alpha = float(rng.uniform(0.75, 1.15))
        patch = np.clip(patch.astype(np.float32) * alpha, 0, 255).astype(np.uint8)

    tampered[ty : ty + patch_h, tx : tx + patch_w] = patch
    mask[ty : ty + patch_h, tx : tx + patch_w] = 255
    cv2.rectangle(
        tampered,
        (tx, ty),
        (tx + patch_w, ty + patch_h),
        color=tuple(int(x) for x in rng.integers(10, 245, size=3)),
        thickness=max(1, int(min(height, width) * 0.008)),
    )
    if rng.random() > 0.5:
        radius = int(rng.integers(max(6, width // 28), max(10, width // 16)))
        cx = int(rng.integers(radius, width - radius))
        cy = int(rng.integers(radius, height - radius))
        color = tuple(int(x) for x in rng.integers(10, 245, size=3))
        cv2.circle(tampered, (cx, cy), radius, color, thickness=-1)
        cv2.circle(mask, (cx, cy), radius, 255, thickness=-1)
    return tampered, mask


def _tamper(image: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    tampered, _ = _tamper_with_mask(image, rng)
    return tampered


def generate_synthetic_dataset(
    output_root: str | Path,
    num_authentic: int = 120,
    num_tampered: int = 120,
    image_size: tuple[int, int] = (256, 256),
    seed: int = 42,
) -> None:
    root = Path(output_root)
    authentic_dir = root / "authentic"
    tampered_dir = root / "tampered"
    mask_dir = root / "groundtruth"
    authentic_dir.mkdir(parents=True, exist_ok=True)
    tampered_dir.mkdir(parents=True, exist_ok=True)
    mask_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(seed)
    for idx in range(num_authentic):
        img = _base_image(rng, image_size)
        cv2.imwrite(str(authentic_dir / f"auth_{idx:04d}.jpg"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))

    for idx in range(num_tampered):
        img = _base_image(rng, image_size)
        forged, mask = _tamper_with_mask(img, rng)
        cv2.imwrite(str(tampered_dir / f"tampered_{idx:04d}.jpg"), cv2.cvtColor(forged, cv2.COLOR_RGB2BGR))
        cv2.imwrite(str(mask_dir / f"tampered_{idx:04d}.png"), mask)


def generate_synthetic_splicing_dataset(
    output_root: str | Path,
    num_authentic: int = 240,
    num_tampered: int = 240,
    image_size: tuple[int, int] = (256, 256),
    seed: int = 42,
) -> None:
    generate_synthetic_dataset(
        output_root=output_root,
        num_authentic=num_authentic,
        num_tampered=num_tampered,
        image_size=image_size,
        seed=seed,
    )
