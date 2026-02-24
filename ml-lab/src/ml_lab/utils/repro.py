from __future__ import annotations

import os
import random
from typing import Optional

import numpy as np


def set_global_seed(seed: int, deterministic: Optional[bool] = None) -> None:
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)

    if deterministic is not None:
        os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8" if deterministic else ""
