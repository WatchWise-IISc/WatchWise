"""Make the repo root importable and parse the shared CLI flags.

Every stage script does ``from _bootstrap import parse_args`` so the package
imports resolve whether the script is launched from the repo root or elsewhere
(e.g. a Kaggle notebook cell).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def parse_args(description: str = "") -> argparse.Namespace:
    p = argparse.ArgumentParser(description=description)
    p.add_argument("--phase", default="phase2", choices=["phase1", "phase2"],
                   help="phase2=ml-25m (default), phase1=ml-latest-small (dev)")
    p.add_argument("--accelerator", default="auto",
                   help="auto | cpu/none | mps | cuda/p100 | cuda_multi/t4x2 | tpu")
    p.add_argument("--no-text-encoder", action="store_true",
                   help="force the deterministic TF-IDF+SVD text fallback")
    p.add_argument("--seed", type=int, default=None, help="override the config seed")
    return p.parse_args()
