"""Non-circular evaluation (spec §14).

Two families of metrics per slate:

* **Held-out (non-circular):** Group NDCG@K / Hit@K against each member's *real
  held-out* ratings, plus their worst-member versions. The model never trained on
  these ratings, so they are genuine generalisation — this is what proves the
  method works rather than asserting it.
* **Predicted-proxy (optimisation-aligned):** member satisfaction (mean / min /
  gap / variance) and slate diversity, computed from predicted ratings. The ``min``
  is the headline fairness proxy; it is explicitly a proxy (spec §6.0.1), validated
  by the held-out metrics moving the same direction.

The headline comparison is on *divergent-taste* groups: the average baseline scores
well on relevance but poorly on the worst-off member; WatchWise lifts the worst-off
member with little/no loss in relevance.
"""
from __future__ import annotations

import math
from typing import Dict, List, Sequence

import numpy as np
import pandas as pd

from .candidates import CatalogSpace
from .config import WatchWiseConfig
from .groups import Group, by_kind
from .models.mf import MFArtifacts
from .pipeline import METHODS, Recommender


def _ndcg_at_k(slate: Sequence[int], member_test: Dict[int, float], k: int) -> float:
    gains = [member_test.get(int(m), 0.0) for m in list(slate)[:k]]
    dcg = sum(g / math.log2(i + 2) for i, g in enumerate(gains))
    ideal = sorted(member_test.values(), reverse=True)[:k]
    idcg = sum(g / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg > 0 else 0.0


def evaluate_slate(group: Group, slate: List[int], mf: MFArtifacts,
                   space: CatalogSpace, cfg: WatchWiseConfig) -> Dict[str, float]:
    members = group.members
    k = cfg.top_k
    if len(slate) == 0:
        return {m: float("nan") for m in
                ["relevance", "min_member_sat", "fairness_gap", "disagreement",
                 "diversity", "group_ndcg", "group_hit", "min_member_ndcg",
                 "min_member_hit"]}

    # taste-fit satisfaction (per-member percentile) — same proxy the reranker uses
    sat = space.member_satisfaction(members, slate)   # [members, len(slate)] in [0,1]
    member_best = sat.max(axis=1)                     # each member's best option
    overall_relevance = float(sat.mean())             # how good the list is for all

    # held-out, non-circular
    ndcgs, hits = [], []
    for u in members:
        gt = {int(m): float(r) for m, r in group.ground_truth.get(str(u), {}).items()}
        relevant = {m for m, r in gt.items() if r >= cfg.relevant_threshold}
        ndcgs.append(_ndcg_at_k(slate, gt, k))
        hits.append(1.0 if any(int(m) in relevant for m in slate) else 0.0)
    ndcgs, hits = np.array(ndcgs), np.array(hits)

    # diversity (semantic)
    if len(slate) >= 2:
        tv = space.text[np.array(slate)]
        sim = tv @ tv.T
        iu = np.triu_indices(len(slate), k=1)
        diversity = float(1.0 - sim[iu].mean())
    else:
        diversity = 0.0

    return {
        "relevance": overall_relevance,
        "min_member_sat": float(member_best.min()),
        "fairness_gap": float(member_best.max() - member_best.min()),
        "disagreement": float(member_best.var()),
        "diversity": diversity,
        "group_ndcg": float(ndcgs.mean()),
        "group_hit": float(hits.mean()),
        "min_member_ndcg": float(ndcgs.min()),
        "min_member_hit": float(hits.min()),
    }


def _aggregate(rows: List[Dict[str, float]]) -> Dict[str, float]:
    if not rows:
        return {}
    keys = rows[0].keys()
    return {k: float(np.nanmean([r[k] for r in rows])) for k in keys}


def run_comparison(rec: Recommender, groups: List[Group], cfg: WatchWiseConfig,
                   methods: Sequence[str] = METHODS) -> pd.DataFrame:
    """Run every method over every group; aggregate overall and per kind."""
    records = []
    coverage = {m: set() for m in methods}
    for method in methods:
        per_kind_rows: Dict[str, List[dict]] = {"random": [], "similar": [],
                                                "divergent": [], "all": []}
        for g in groups:
            res = rec.recommend(g.members, method, seen=g.seen)
            coverage[method].update(res.slate)
            metrics = evaluate_slate(g, res.slate, rec.mf, rec.space, cfg)
            per_kind_rows[g.kind].append(metrics)
            per_kind_rows["all"].append(metrics)
        for kind, rows in per_kind_rows.items():
            agg = _aggregate(rows)
            if not agg:
                continue
            agg.update({"method": method, "kind": kind, "n_groups": len(rows),
                        "coverage": len(coverage[method]) / rec.space.n_movies})
            records.append(agg)
    return pd.DataFrame(records)


def run_w2_sweep(rec: Recommender, groups: List[Group], cfg: WatchWiseConfig,
                 method: str = "diffusion_greedy") -> pd.DataFrame:
    """Trace the fairness-vs-relevance trade-off by sweeping ``w2`` (spec §12.6).

    The candidate pool depends only on the group (not on ``w2``), so we generate it
    once per group and only re-run the cheap greedy reranker for each ``w2``.
    """
    from .models.reranker import greedy_fairness_select
    from .reward import build_reward_model

    divergent = by_kind(groups, "divergent")
    pools = []
    for g in divergent:
        exclude = set(g.seen)
        pool = rec._pool(method, g.members, exclude, cfg.candidate_pool_size)
        if pool:
            pools.append((g, pool))

    rows = []
    for w2 in cfg.w2_sweep:
        weights = {"w1": cfg.w1_sum, "w2": w2,
                   "w3": cfg.w3_diversity, "w4": cfg.w4_disagreement}
        metrics = []
        for g, pool in pools:
            rm = build_reward_model(rec.mf, rec.space, cfg, g.members, pool, weights)
            chosen = greedy_fairness_select(rm, cfg.slate_size)
            slate = [int(pool[i]) for i in chosen]
            metrics.append(evaluate_slate(g, slate, rec.mf, rec.space, cfg))
        agg = _aggregate(metrics)
        agg.update({"w2": w2, "method": method, "n_groups": len(pools)})
        rows.append(agg)
    return pd.DataFrame(rows)
