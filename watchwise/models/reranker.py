"""Reranking selectors (spec §10.2). Diffusion proposes; the reranker decides.

Two non-learning selectors live here:

* :func:`greedy_fairness_select` — the committed "bandit" MVP: a one-shot greedy
  reward-maximiser that repeatedly adds the candidate with the largest marginal
  contribution to the fairness-aware reward. Reliable, no training instability.
* :func:`average_aggregation_select` — the naive baseline: rank by the *mean*
  predicted rating across members and take the top-K. No fairness term, so it
  quietly sacrifices the minority taste — exactly the failure WatchWise targets.

Both return indices **into the candidate pool**. The learned RL slate-builder
(``models/rl.py``) is the headline alternative to the greedy selector and consumes
the identical pool + reward, so the bandit-vs-RL comparison is controlled.
"""
from __future__ import annotations

from typing import List

import numpy as np

from ..reward import RewardModel


def greedy_fairness_select(rm: RewardModel, k: int) -> List[int]:
    """Greedily build a K-slate maximising the marginal fairness-aware reward."""
    k = min(k, rm.n_pool)
    slate: List[int] = []
    remaining = set(range(rm.n_pool))
    for _ in range(k):
        best_c, best_gain = None, -np.inf
        cur = rm.reward(slate)
        for c in remaining:
            gain = rm.reward(slate + [c]) - cur
            if gain > best_gain:
                best_gain, best_c = gain, c
        if best_c is None:
            break
        slate.append(best_c)
        remaining.discard(best_c)
    return slate


def average_aggregation_select(rm: RewardModel, k: int) -> List[int]:
    """Naive baseline: top-K pool movies by mean member satisfaction."""
    k = min(k, rm.n_pool)
    mean_sat = rm.sat.mean(axis=0)              # [n_pool]
    return list(np.argsort(-mean_sat)[:k])
