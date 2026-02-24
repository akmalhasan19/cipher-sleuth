from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Dict

import yaml


def load_config(config_path: str | Path) -> Dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with path.open("r", encoding="utf-8") as fh:
        config = yaml.safe_load(fh)

    if not isinstance(config, dict):
        raise ValueError("Configuration must be a mapping (YAML object)")

    return config


def resolve_paths(config: Dict[str, Any], base_dir: str | Path) -> Dict[str, Any]:
    """Resolve configured paths against the ml-lab base directory."""
    config = copy.deepcopy(config)
    base = Path(base_dir).resolve()
    paths = config.get("paths", {})
    for key, value in paths.items():
        if not isinstance(value, str):
            continue
        candidate = Path(value)
        if not candidate.is_absolute():
            paths[key] = str((base / candidate).resolve())
        else:
            paths[key] = str(candidate)

    config["paths"] = paths
    return config
