"""End-to-end recommendation for a group (spec §5 inference flow).

One :class:`Recommender` exposes every approach behind a single ``recommend`` call,
so evaluation and the demo share identical code. The methods are exactly the
ablations in spec §10.4:

    avg_baseline      naive: average member ratings, take top-K (no fairness)
    nn_greedy         traditional NN candidates  + greedy fairness reranker
    diffusion_greedy  diffusion candidates       + greedy fairness reranker   (swap test)
    nn_rl             traditional NN candidates  + RL slate-builder
    diffusion_rl      diffusion candidates       + RL slate-builder           (headline)

Ablation fairness is enforced structurally: candidate-generation comparisons share
the reranker + filters; reranker comparisons share the pool + filters.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd

from .accelerator import Accelerator
from .candidates import CatalogSpace
from .config import RegionConfig, WatchWiseConfig
from .filters import disallowed_movies
from .models.diffusion import GroupDiffusion
from .models.mf import MFArtifacts
from .models.reranker import average_aggregation_select, greedy_fairness_select
from .models.rl import GroupEpisode, SlatePolicy, make_episode, rl_select
from .reward import build_reward_model

METHODS = ["avg_baseline", "nn_greedy", "diffusion_greedy", "nn_rl", "diffusion_rl"]
METHOD_LABELS = {
    "avg_baseline": "Average baseline (top-K mean)",
    "nn_greedy": "NN candidates + fairness reranker",
    "diffusion_greedy": "Diffusion candidates + fairness reranker",
    "nn_rl": "NN candidates + RL slate-builder",
    "diffusion_rl": "Diffusion candidates + RL slate-builder",
}


@dataclass
class RecResult:
    method: str
    slate: List[int]           # final movie m_idx (length K)
    pool: List[int]            # candidate pool m_idx the reranker chose from
    members: List[int]


class Recommender:
    def __init__(self, cfg: WatchWiseConfig, accel: Accelerator, mf: MFArtifacts,
                 space: CatalogSpace, catalog: pd.DataFrame,
                 diff: Optional[GroupDiffusion] = None,
                 policy: Optional[SlatePolicy] = None):
        self.cfg = cfg
        self.accel = accel
        self.mf = mf
        self.space = space
        self.catalog = catalog
        self.diff = diff
        self.policy = policy

    # ------------------------------------------------------------------ #
    def _exclude(self, seen: Sequence[int], region: Optional[RegionConfig],
                 allow_teen: bool) -> set:
        ex = set(int(s) for s in (seen or []))
        ex |= disallowed_movies(self.catalog, region, allow_teen)
        return ex

    def _pool(self, method: str, members: Sequence[int], exclude: set,
              pool_size: int) -> List[int]:
        if method.startswith("diffusion"):
            if self.diff is None:
                raise ValueError("diffusion method requested but no diffusion model loaded")
            return self.space.diffusion_candidates(self.diff, members, pool_size, exclude)
        return self.space.nn_candidates(members, pool_size, exclude)

    # ------------------------------------------------------------------ #
    def recommend(self, members: Sequence[int], method: str,
                  seen: Optional[Sequence[int]] = None,
                  region: Optional[RegionConfig] = None, allow_teen: bool = True,
                  weights: Optional[Dict[str, float]] = None) -> RecResult:
        members = [int(m) for m in members]
        exclude = self._exclude(seen, region, allow_teen)
        k = self.cfg.slate_size

        if method == "avg_baseline":
            eligible = np.array([m for m in range(self.space.n_movies)
                                 if m not in exclude])
            pred = self.mf.predict(members, eligible)            # [members, n_eligible]
            order = eligible[np.argsort(-pred.mean(0))]
            slate = [int(m) for m in order[:k]]
            return RecResult(method, slate, slate, members)

        pool = self._pool(method, members, exclude, self.cfg.candidate_pool_size)
        if len(pool) == 0:                                       # filters left nothing
            return RecResult(method, [], [], members)
        rm = build_reward_model(self.mf, self.space, self.cfg, members, pool, weights)

        if method.endswith("greedy"):
            chosen = greedy_fairness_select(rm, k)
        elif method.endswith("rl"):
            if self.policy is None:
                raise ValueError("RL method requested but no policy loaded")
            ep = make_episode(rm, self.space.Z[np.array(pool)],
                              self.space.group_cond_std(members))
            chosen = rl_select(self.policy, ep, self.cfg, self.accel)
        else:
            raise ValueError(f"unknown method {method}")

        slate = [int(pool[i]) for i in chosen]
        return RecResult(method, slate, [int(p) for p in pool], members)

    # ------------------------------------------------------------------ #
    def make_episode_for(self, members: Sequence[int], pool: Sequence[int],
                         weights: Optional[Dict[str, float]] = None) -> GroupEpisode:
        rm = build_reward_model(self.mf, self.space, self.cfg, members, pool, weights)
        return make_episode(rm, self.space.Z[np.array(pool)],
                            self.space.group_cond_std(members))
