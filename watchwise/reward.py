"""Fairness-aware group reward (spec §10.1) — the heart of WatchWise.

A family is shown a short list and watches the one that suits them, so a member's
satisfaction with a slate is their **best option** in it: ``sat_i(S) = max_{m in S}
pred(i, m)``. The reward then mixes four terms (member satisfaction normalised to
[0, 1] so the weights are comparable):

    Reward(S) =  w1 * mean_i  sat_i(S)        # total group relevance
               + w2 * min_i   sat_i(S)        # protect the worst-off member  <- differentiator
               + w3 * diversity(S)            # intra-list dissimilarity (semantic)
               - w4 * var_i   sat_i(S)        # penalise disagreement across members

The ``min`` term is what an average-aggregation baseline ignores; sweeping ``w2``
traces the fairness-vs-relevance trade-off (a headline artifact, spec §12.6).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Sequence

import numpy as np

from .candidates import CatalogSpace
from .config import WatchWiseConfig
from .models.mf import MFArtifacts

RATING_MIN, RATING_MAX = 0.5, 5.0


def normalize_rating(pred: np.ndarray) -> np.ndarray:
    """Map a predicted rating in [0.5, 5] to a satisfaction in [0, 1]."""
    return np.clip((pred - RATING_MIN) / (RATING_MAX - RATING_MIN), 0.0, 1.0)


def predicted_member_matrix(mf: MFArtifacts, user_idxs: Sequence[int],
                            movie_idxs: Sequence[int]) -> np.ndarray:
    """[n_members, n_movies] predicted ratings (raw rating units)."""
    return mf.predict(np.asarray(user_idxs), np.asarray(movie_idxs))


@dataclass
class RewardModel:
    """Evaluates the fairness reward for slates drawn from a fixed candidate pool.

    All slate operations index into the pool, so both the greedy selector and the
    RL policy share one definition of the objective.
    """

    sat: np.ndarray            # [n_members, n_pool] satisfaction in [0, 1]
    sim: np.ndarray            # [n_pool, n_pool] cosine similarity (for diversity)
    w1: float
    w2: float
    w3: float
    w4: float

    @property
    def n_members(self) -> int:
        return self.sat.shape[0]

    @property
    def n_pool(self) -> int:
        return self.sat.shape[1]

    # ------------------------------------------------------------------ #
    def member_sat(self, slate: Sequence[int]) -> np.ndarray:
        """Each member's best satisfaction across the slate -> [n_members]."""
        if len(slate) == 0:
            return np.zeros(self.n_members, dtype=np.float32)
        return self.sat[:, list(slate)].max(axis=1)

    def diversity(self, slate: Sequence[int]) -> float:
        if len(slate) < 2:
            return 0.0
        s = list(slate)
        sub = self.sim[np.ix_(s, s)]
        iu = np.triu_indices(len(s), k=1)
        return float(1.0 - sub[iu].mean())

    def breakdown(self, slate: Sequence[int]) -> Dict[str, float]:
        if len(slate) == 0:
            return {"total": 0.0, "relevance": 0.0, "fairness": 0.0,
                    "diversity": 0.0, "disagreement": 0.0}
        sub = self.sat[:, list(slate)]
        best = sub.max(axis=1)          # each member's best option in the slate
        # Relevance = how good the list is on average for everyone (rewards
        # broadly-good lists -> favours the majority). Fairness = the worst-off
        # member's best option (rewards coverage). These genuinely trade off, so w2
        # is a real knob, not redundant with relevance.
        relevance = float(sub.mean())
        fairness = float(best.min())
        div = self.diversity(slate)
        disagree = float(best.var())
        total = (self.w1 * relevance + self.w2 * fairness
                 + self.w3 * div - self.w4 * disagree)
        return {"total": total, "relevance": relevance, "fairness": fairness,
                "diversity": div, "disagreement": disagree}

    def reward(self, slate: Sequence[int]) -> float:
        return self.breakdown(slate)["total"]

    def marginal(self, current: Sequence[int], candidate: int) -> float:
        """Reward gain from adding ``candidate`` to ``current``."""
        return self.reward(list(current) + [candidate]) - self.reward(current)


def build_reward_model(mf: MFArtifacts, space: CatalogSpace, cfg: WatchWiseConfig,
                       user_idxs: Sequence[int], pool: Sequence[int],
                       weights: Dict[str, float] = None) -> RewardModel:
    """Assemble a :class:`RewardModel` for one group + candidate pool."""
    w = weights or cfg.reward_weights()
    # Taste-fit satisfaction (per-member percentile) so heterogeneous members
    # genuinely disagree and the fairness `min`/`w2` terms have something to resolve.
    sat = space.member_satisfaction(user_idxs, pool)           # [members, pool] in [0,1]

    # Diversity uses the *semantic* (text) space so it rewards genuinely different
    # movies, not just latent-space jitter; fall back to latent if text is degenerate.
    pool = np.asarray(pool)
    tvec = space.text[pool]
    sim = tvec @ tvec.T
    if not np.isfinite(sim).all() or np.allclose(sim, sim[0, 0]):
        lvec = space.Zn[pool]
        sim = lvec @ lvec.T
    return RewardModel(sat=sat.astype(np.float32), sim=sim.astype(np.float32),
                       w1=w["w1"], w2=w["w2"], w3=w["w3"], w4=w["w4"])
