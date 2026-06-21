"""Stage 7 (optional) — Phase 1 vs Phase 2 comparison (spec §13.3, D4).

Reads `results/<phase>/comparison.csv` for whichever phases have been run and
contrasts the divergent-group headline metrics. Phase 2 (`ml-25m`) is run with the
identical scripts on a GPU/TPU (`--phase phase2 --accelerator cuda`); this script
just tabulates both once they exist, so it works incrementally.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from _bootstrap import parse_args  # noqa: F401  (keeps CLI uniform)
from watchwise.config import ROOT
from watchwise.utils import banner

METHODS = ["avg_baseline", "nn_greedy", "diffusion_greedy", "nn_rl", "diffusion_rl"]
KEYS = ["relevance", "min_member_sat", "fairness_gap", "group_ndcg", "group_hit", "diversity"]


def main() -> None:
    banner("PHASE 1 vs PHASE 2 COMPARISON")
    frames = {}
    for phase in ["phase1", "phase2"]:
        p = ROOT / "results" / phase / "comparison.csv"
        if p.exists():
            df = pd.read_csv(p)
            frames[phase] = df[df.kind == "divergent"].set_index("method")
            print(f"  found {phase}: {p}")
        else:
            print(f"  (missing {phase}: run `python scripts/run_all.py --phase {phase} "
                  f"--accelerator cuda`)")

    if not frames:
        print("\nNo results yet. Run the pipeline first.")
        return

    rows = []
    for method in METHODS:
        for phase, df in frames.items():
            if method in df.index:
                r = df.loc[method]
                rows.append({"phase": phase, "method": method,
                             **{k: round(float(r[k]), 3) for k in KEYS}})
    out = pd.DataFrame(rows)
    out_path = ROOT / "results" / "phase_comparison.csv"
    out.to_csv(out_path, index=False)
    print("\n" + out.to_string(index=False))
    print(f"\n  saved -> {out_path}")
    if len(frames) < 2:
        print("\n  (Only one phase present — run the other phase to complete the "
              "comparison. Phase 2 is expected to be as good or better, spec §13.3.)")


if __name__ == "__main__":
    main()
