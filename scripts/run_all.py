"""Run the whole WatchWise pipeline end-to-end (stages 1-6).

Examples
--------
    python scripts/run_all.py --accelerator auto          # local (mps/cuda/cpu)
    python scripts/run_all.py --accelerator cpu           # Kaggle "None"
    python scripts/run_all.py --accelerator cuda          # Kaggle "GPU P100"
    python scripts/run_all.py --accelerator cuda_multi    # Kaggle "GPU T4 x2"
    python scripts/run_all.py --accelerator tpu           # Kaggle "TPU v5e-8"
    python scripts/run_all.py --phase phase2 --accelerator cuda   # scale (ml-25m)
"""
from __future__ import annotations

import runpy
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
# runpy.run_path does not add the script's own dir to sys.path, so the stages'
# `from _bootstrap import ...` needs scripts/ here explicitly.
for p in (str(ROOT), str(SCRIPTS)):
    if p not in sys.path:
        sys.path.insert(0, p)

STAGES = [
    "01_prepare_data.py",
    "02_train_mf.py",
    "03_train_diffusion.py",
    "04_form_groups.py",
    "05_train_rl.py",
    "06_evaluate.py",
]


def main() -> None:
    here = Path(__file__).resolve().parent
    passthru = sys.argv[1:]            # forwarded to every stage (--phase/--accelerator/...)
    t0 = time.perf_counter()
    for stage in STAGES:
        print(f"\n############### RUNNING {stage} ###############")
        sys.argv = [str(here / stage)] + passthru
        runpy.run_path(str(here / stage), run_name="__main__")
    mins = (time.perf_counter() - t0) / 60
    print(f"\n=== WatchWise pipeline complete in {mins:.1f} min. "
          f"Results in results/, demo: python app/demo.py ===")


if __name__ == "__main__":
    main()
