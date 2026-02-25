from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import pandas as pd
from PIL import Image

LOGGER = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
CLASS_ALIASES: Dict[str, int] = {
    "authentic": 0,
    "au": 0,
    "clean": 0,
    "pristine": 0,
    "real": 0,
    "untampered": 0,
    "tampered": 1,
    "tp": 1,
    "fake": 1,
    "forged": 1,
    "manipulated": 1,
}

IGNORED_DIR_PARTS = {
    "casia 2 groundtruth",
    "groundtruth",
    "mask",
    "masks",
    "gt",
}
MASK_DIR_PARTS = {
    "casia 2 groundtruth",
    "groundtruth",
    "mask",
    "masks",
    "gt",
}


def _normalize_mask_key(stem: str) -> str:
    return (
        stem.lower()
        .replace("_gt", "")
        .replace("_mask", "")
        .replace("-gt", "")
        .replace("-mask", "")
        .strip()
    )


def _index_mask_candidates(dataset_root: Path) -> dict[str, str]:
    index: dict[str, str] = {}
    for path in dataset_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        parts = {part.lower() for part in path.parts}
        if not parts.intersection(MASK_DIR_PARTS):
            continue

        key = _normalize_mask_key(path.stem)
        if key and key not in index:
            index[key] = str(path.resolve())
    return index


def _iter_image_paths(dataset_root: Path) -> Iterable[Path]:
    for path in dataset_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        parts = {part.lower() for part in path.parts}
        if parts.intersection(IGNORED_DIR_PARTS):
            continue
        yield path


def _infer_label_from_path(path: Path, dataset_root: Path) -> int:
    relative_parts = [part.lower() for part in path.relative_to(dataset_root).parts]
    for part in relative_parts:
        if part in CLASS_ALIASES:
            return CLASS_ALIASES[part]

    raise ValueError(
        f"Cannot infer label for {path}. Expected class directory names such as "
        "authentic/tampered (or aliases)."
    )


def _md5sum(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _image_meta(path: Path) -> Tuple[int, int, str]:
    with Image.open(path) as img:
        width, height = img.size
        image_format = (img.format or "unknown").lower()
    return width, height, image_format


def build_manifest(dataset_root: str | Path, source_dataset: str, perturbation_tag: str = "clean") -> pd.DataFrame:
    root = Path(dataset_root)
    if not root.exists():
        raise FileNotFoundError(f"Dataset root not found: {root}")

    mask_index = _index_mask_candidates(root)
    rows: List[Dict[str, object]] = []
    for path in _iter_image_paths(root):
        try:
            label = _infer_label_from_path(path, root)
            width, height, image_format = _image_meta(path)
            mask_path: str | None = None
            if label == 1:
                mask_key = _normalize_mask_key(path.stem)
                mask_path = mask_index.get(mask_key)
            rows.append(
                {
                    "image_path": str(path.resolve()),
                    "label": int(label),
                    "mask_path": mask_path,
                    "source_dataset": source_dataset,
                    "split": "unspecified",
                    "perturbation_tag": perturbation_tag,
                    "width": width,
                    "height": height,
                    "image_format": image_format,
                    "file_md5": _md5sum(path),
                }
            )
        except Exception as exc:
            LOGGER.warning("Skipping %s due to error: %s", path, exc)

    if not rows:
        raise ValueError(f"No valid images found in {root}")

    manifest = pd.DataFrame(rows)
    manifest = manifest.sort_values("image_path").reset_index(drop=True)
    return manifest


def save_manifest(manifest: pd.DataFrame, output_csv: str | Path) -> None:
    out = Path(output_csv)
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest.to_csv(out, index=False)
    LOGGER.info("Manifest saved: %s (%d rows)", out, len(manifest))


def load_manifest(path: str | Path) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Manifest not found: {p}")
    return pd.read_csv(p)


def get_data_card_summary(manifest: pd.DataFrame) -> Dict[str, object]:
    label_counts = manifest["label"].value_counts().sort_index().to_dict()
    format_counts = manifest["image_format"].value_counts().to_dict()
    resolution_summary = {
        "width_min": int(manifest["width"].min()),
        "width_max": int(manifest["width"].max()),
        "height_min": int(manifest["height"].min()),
        "height_max": int(manifest["height"].max()),
    }
    duplicate_md5 = int(manifest["file_md5"].duplicated().sum())
    mask_available_count = int(manifest.get("mask_path", pd.Series(dtype=object)).fillna("").astype(str).str.len().gt(0).sum())

    return {
        "num_images": int(len(manifest)),
        "label_distribution": {str(k): int(v) for k, v in label_counts.items()},
        "format_distribution": {str(k): int(v) for k, v in format_counts.items()},
        "resolution_summary": resolution_summary,
        "exact_duplicate_count": duplicate_md5,
        "mask_available_count": mask_available_count,
    }
