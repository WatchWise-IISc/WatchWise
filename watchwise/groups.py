"""Synthetic group formation (spec §11) — families from real MovieLens users.

No public dataset has real "who-watched-together" labels (CAMRa2011 is
unobtainable), so we synthesise groups over real users — the standard, reproducible
practice. Three difficulty regimes:

* **random**     — uniform members (baseline difficulty),
* **similar**    — members from one taste cluster (easy consensus; sanity check),
* **divergent**  — one member per distinct cluster (hard consensus; the demo
  punchline where fairness-aware reranking should shine).

Each member's *held-out* highly-rated movies are the non-circular ground truth.
Groups are split into disjoint train/val/test sets so the RL policy is evaluated on
unseen groups (spec §10.3). The honesty commitment: families are synthetic and
"group satisfaction" is a predicted-rating proxy — never real co-viewing (spec §18.2).
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

from .config import WatchWiseConfig
from .models.mf import MFArtifacts


@dataclass
class Group:
    gid: int
    kind: str                      # random | similar | divergent
    split: str                     # train | val | test
    members: List[int]             # member u_idx values
    seen: List[int]                # combined train-history m_idx (exclude from pool)
    # per-member held-out items: {u_idx(str): {m_idx(str): rating}}
    ground_truth: Dict[str, Dict[str, float]]

    def relevant(self, u_idx: int, threshold: float) -> set:
        gt = self.ground_truth.get(str(u_idx), {})
        return {int(m) for m, r in gt.items() if r >= threshold}


def _kmeans_labels(user_factors: np.ndarray, eligible: np.ndarray,
                   n_clusters: int, seed: int) -> Dict[int, int]:
    km = KMeans(n_clusters=n_clusters, random_state=seed, n_init=10)
    labels = km.fit_predict(user_factors[eligible])
    return {int(u): int(l) for u, l in zip(eligible, labels)}


def form_groups(mf: MFArtifacts, train_df: pd.DataFrame, test_df: pd.DataFrame,
                cfg: WatchWiseConfig) -> List[Group]:
    """Build random/similar/divergent groups with held-out ground truth."""
    rng = np.random.default_rng(cfg.seed)

    # Eligible members = users with held-out test items.
    eligible = np.array(sorted(test_df["u_idx"].unique()))
    train_by_user = train_df.groupby("u_idx")["m_idx"].apply(set).to_dict()
    test_by_user: Dict[int, Dict[int, float]] = {}
    for u, grp in test_df.groupby("u_idx"):
        test_by_user[int(u)] = {int(m): float(r)
                                for m, r in zip(grp["m_idx"], grp["rating"])}

    n_clusters = min(cfg.num_taste_clusters, len(eligible))
    km = KMeans(n_clusters=n_clusters, random_state=cfg.seed, n_init=10)
    elig_labels = km.fit_predict(mf.user_factors[eligible])
    labels = {int(u): int(l) for u, l in zip(eligible, elig_labels)}
    centers = km.cluster_centers_
    cluster_members: Dict[int, List[int]] = {}
    for u, l in labels.items():
        cluster_members.setdefault(l, []).append(u)
    clusters = sorted(cluster_members)

    # Distance of each user from the global taste centroid (how "extreme" they are).
    global_mean = mf.user_factors[eligible].mean(0)
    extremity = {int(u): float(np.linalg.norm(mf.user_factors[u] - global_mean))
                 for u in eligible}

    def _farthest_clusters(size: int) -> List[int]:
        """Greedy farthest-point set of clusters (maximally opposed tastes)."""
        if size >= len(clusters):
            return list(clusters)
        start = int(rng.integers(len(clusters)))
        chosen = [clusters[start]]
        while len(chosen) < size:
            best, bestd = None, -1.0
            for c in clusters:
                if c in chosen:
                    continue
                d = min(np.linalg.norm(centers[c] - centers[cc]) for cc in chosen)
                if d > bestd:
                    bestd, best = d, c
            chosen.append(best)
        return chosen

    def _sample_random(size: int) -> List[int]:
        return list(rng.choice(eligible, size=size, replace=False))

    def _sample_similar(size: int) -> List[int]:
        pool = []
        cl = rng.permutation(clusters)
        for c in cl:                       # find a cluster big enough
            if len(cluster_members[c]) >= size:
                pool = cluster_members[c]
                break
        if not pool:                       # fallback: biggest cluster
            pool = max(cluster_members.values(), key=len)
        return list(rng.choice(pool, size=min(size, len(pool)), replace=False))

    def _sample_divergent(size: int) -> List[int]:
        # Maximally-opposed clusters, and from each pick an *extreme* representative
        # (far from the global taste centroid) so members genuinely disagree.
        chosen_clusters = _farthest_clusters(size)
        members = []
        for c in chosen_clusters:
            cands = sorted(cluster_members[c], key=lambda u: -extremity[u])
            top = cands[:max(1, len(cands) // 3)]      # a most-extreme third
            members.append(int(rng.choice(top)))
        while len(members) < size:                     # size > #clusters: top up
            extra = int(rng.choice(eligible))
            if extra not in members:
                members.append(extra)
        return members

    samplers = {"random": _sample_random, "similar": _sample_similar,
                "divergent": _sample_divergent}
    per_kind = cfg.num_groups // 3

    groups: List[Group] = []
    gid = 0
    for kind, sampler in samplers.items():
        for _ in range(per_kind):
            size = int(rng.integers(cfg.group_size_min, cfg.group_size_max + 1))
            members = [int(m) for m in sampler(size)]
            seen = set()
            for m in members:
                seen |= train_by_user.get(m, set())
            gt = {str(m): {str(k): v for k, v in test_by_user.get(m, {}).items()}
                  for m in members}
            groups.append(Group(gid=gid, kind=kind, split="train",
                                 members=members, seen=sorted(seen),
                                 ground_truth=gt))
            gid += 1

    _assign_splits(groups, cfg, rng)
    kinds = pd.Series([g.kind for g in groups]).value_counts().to_dict()
    splits = pd.Series([g.split for g in groups]).value_counts().to_dict()
    print(f"[groups] formed {len(groups)} groups  kinds={kinds}  splits={splits}")
    return groups


def _assign_splits(groups: List[Group], cfg: WatchWiseConfig, rng) -> None:
    """Group-level train/val/test split, stratified within each kind."""
    tr, va, _ = cfg.group_split
    by_kind: Dict[str, List[Group]] = {}
    for g in groups:
        by_kind.setdefault(g.kind, []).append(g)
    for kind_groups in by_kind.values():
        idx = rng.permutation(len(kind_groups))
        n = len(idx)
        n_tr, n_va = int(n * tr), int(n * va)
        for rank, i in enumerate(idx):
            kind_groups[i].split = ("train" if rank < n_tr
                                    else "val" if rank < n_tr + n_va else "test")


def save_groups(groups: List[Group], path) -> None:
    json.dump([asdict(g) for g in groups], open(path, "w"))


def load_groups(path) -> List[Group]:
    return [Group(**g) for g in json.load(open(path))]


def split_groups(groups: List[Group], split: str) -> List[Group]:
    return [g for g in groups if g.split == split]


def by_kind(groups: List[Group], kind: str) -> List[Group]:
    return [g for g in groups if g.kind == kind]
