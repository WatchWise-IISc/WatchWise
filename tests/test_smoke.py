"""Lightweight smoke tests — validate the trained pipeline's contracts.

Run after `python scripts/run_all.py`:  `python -m pytest tests/ -q`  (or just
`python tests/test_smoke.py`). These assert structural correctness and the core
scientific invariants, not exact metric values.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Which cached phase to validate. Default phase1; set WATCHWISE_PHASE=phase2 to
# validate the scaled (ml-25m) artifacts downloaded from Kaggle.
PHASE = os.environ.get("WATCHWISE_PHASE", "phase1")

from watchwise.accelerator import Accelerator  # noqa: E402
from watchwise.candidates import CatalogSpace  # noqa: E402
from watchwise.config import get_config  # noqa: E402
from watchwise.groups import load_groups, split_groups, by_kind  # noqa: E402
from watchwise.models.diffusion import load_diffusion  # noqa: E402
from watchwise.models.mf import MFArtifacts  # noqa: E402
from watchwise.models.rl import load_policy  # noqa: E402
from watchwise.pipeline import METHODS, Recommender  # noqa: E402
from watchwise.evaluate import evaluate_slate  # noqa: E402


def _engine():
    cfg = get_config(PHASE)
    accel = Accelerator("cpu", verbose=False)
    mf = MFArtifacts.load(cfg.cache_dir / "mf.npz")
    space = CatalogSpace(mf, np.load(cfg.cache_dir / "text_embeddings.npy"), cfg)
    catalog = pd.read_parquet(cfg.cache_dir / "catalog.parquet")
    diff = load_diffusion(cfg.cache_dir / "diffusion.pt", cfg, accel)
    policy = load_policy(cfg.cache_dir / "rl_policy.pt", accel)
    groups = load_groups(cfg.cache_dir / "groups.json")
    rec = Recommender(cfg, accel, mf, space, catalog, diff=diff, policy=policy)
    return cfg, rec, groups


def test_accelerator_aliases():
    for alias in ["none", "cpu", "auto"]:
        a = Accelerator(alias, verbose=False)
        assert a.device is not None


def test_mf_predictions_in_range():
    cfg = get_config(PHASE)
    mf = MFArtifacts.load(cfg.cache_dir / "mf.npz")
    pred = mf.predict([0, 1, 2], [0, 5, 10, 50])
    assert pred.shape == (3, 4)
    assert (pred >= 0.5).all() and (pred <= 5.0).all()


def test_holdout_is_disjoint():
    """Non-circularity: train and test ratings must not overlap (user, movie)."""
    cfg = get_config(PHASE)
    tr = pd.read_parquet(cfg.cache_dir / "train_ratings.parquet")
    te = pd.read_parquet(cfg.cache_dir / "test_ratings.parquet")
    tr_keys = set(zip(tr.userId, tr.movieId))
    te_keys = set(zip(te.userId, te.movieId))
    assert tr_keys.isdisjoint(te_keys), "train/test ratings overlap -> circular eval"


def test_group_splits_disjoint():
    """RL discipline: train/val/test groups must be disjoint sets of gids."""
    cfg = get_config(PHASE)
    groups = load_groups(cfg.cache_dir / "groups.json")
    s = {k: {g.gid for g in split_groups(groups, k)} for k in ("train", "val", "test")}
    assert s["train"].isdisjoint(s["val"])
    assert s["train"].isdisjoint(s["test"])
    assert s["val"].isdisjoint(s["test"])


def test_all_methods_return_full_slate():
    cfg, rec, groups = _engine()
    g = by_kind(split_groups(groups, "test"), "divergent")[0]
    for method in METHODS:
        res = rec.recommend(g.members, method, seen=g.seen)
        assert len(res.slate) == cfg.slate_size, f"{method} returned {len(res.slate)}"
        assert len(set(res.slate)) == len(res.slate), f"{method} has duplicate movies"
        assert not (set(res.slate) & set(g.seen)), f"{method} recommended a seen movie"


def test_fairness_reranker_beats_baseline_worst_off():
    """Core claim: on divergent groups the fairness reranker lifts the worst-off
    member above the naive average baseline (aggregate, not per-group)."""
    cfg, rec, groups = _engine()
    div = by_kind(split_groups(groups, "test"), "divergent")
    base = np.mean([evaluate_slate(g, rec.recommend(g.members, "avg_baseline",
                    seen=g.seen).slate, rec.mf, rec.space, cfg)["min_member_sat"]
                    for g in div])
    ww = np.mean([evaluate_slate(g, rec.recommend(g.members, "diffusion_greedy",
                  seen=g.seen).slate, rec.mf, rec.space, cfg)["min_member_sat"]
                  for g in div])
    assert ww > base, f"fairness reranker ({ww:.3f}) did not beat baseline ({base:.3f})"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} smoke tests passed.")
