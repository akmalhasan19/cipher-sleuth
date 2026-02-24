from __future__ import annotations

import logging
from pathlib import Path


def setup_logging(log_dir: str | Path, run_name: str, level: int = logging.INFO) -> Path:
    out_dir = Path(log_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / f"{run_name}.log"

    root = logging.getLogger()
    root.setLevel(level)

    for handler in list(root.handlers):
        root.removeHandler(handler)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)

    root.addHandler(console_handler)
    root.addHandler(file_handler)

    logging.getLogger(__name__).info("Logging initialized: %s", log_path)
    return log_path
