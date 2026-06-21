"""Small shared helpers: seeding, timing, JSON/npz IO."""
from __future__ import annotations

import json
import random
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator

import numpy as np
import torch


def set_seed(seed: int) -> None:
    """Seed Python, NumPy and Torch for reproducible runs (spec §12.5)."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


@contextmanager
def timer(label: str) -> Iterator[None]:
    start = time.perf_counter()
    print(f"  -> {label} ...", flush=True)
    yield
    print(f"  <- {label} done in {time.perf_counter() - start:.1f}s", flush=True)


def save_json(obj: Dict[str, Any], path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, default=_json_default))


def load_json(path: Path) -> Any:
    return json.loads(Path(path).read_text())


def _json_default(o: Any) -> Any:
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, Path):
        return str(o)
    raise TypeError(f"Not JSON serialisable: {type(o)}")


def banner(title: str) -> None:
    line = "=" * 70
    print(f"\n{line}\n  {title}\n{line}", flush=True)
