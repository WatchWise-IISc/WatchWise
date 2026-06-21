"""Candidate generation — the traditional-vs-diffusion swap (spec §9, §10.4).

Both generators live in the MF movie-latent space and expose the **same
interface** (group -> pool of real movie indices), so the ablation is fair: only
the generation mechanism differs, the downstream reranker and hard filters are
identical.

* :func:`nn_candidates` — *traditional*: rank real movies by similarity to the
  group's centroid in the learned embedding space (textbook collaborative
  retrieval).
* :func:`diffusion_candidates` — *generative*: sample embeddings from the
  conditional denoiser and map each to its nearest real movie.

Group condition vectors are built from the members' MF latents; the denoiser was
trained on ``(user-latent, liked-movie-latent)`` pairs, so conditioning on a
group's averaged latent asks it for movies that fit the *whole* group.
"""
from __future__ import annotations

from typing import List, Optional, Sequence

import numpy as np
import pandas as pd
import torch

from .config import WatchWiseConfig
from .models.diffusion import GroupDiffusion
from .models.mf import MFArtifacts

_EPS = 1e-8


def _l2norm(x: np.ndarray) -> np.ndarray:
    return x / (np.linalg.norm(x, axis=-1, keepdims=True) + _EPS)


class CatalogSpace:
    """Precomputed latent geometry shared by both candidate generators."""

    def __init__(self, mf: MFArtifacts, text_emb: np.ndarray, cfg: WatchWiseConfig):
        self.mf = mf
        self.cfg = cfg
        self.M = mf.movie_factors                       # [n_movies, k] raw
        self.U = mf.user_factors                        # [n_users, k] raw
        self.n_movies = self.M.shape[0]

        # Standardised movie-latent space for generation + nearest-movie mapping.
        self.m_mean = self.M.mean(0)
        self.m_std = self.M.std(0) + _EPS
        self.Z = ((self.M - self.m_mean) / self.m_std).astype(np.float32)
        self.Zn = _l2norm(self.Z)                       # unit vectors for cosine

        # Condition space: standardise user latents with their own stats.
        self.u_mean = self.U.mean(0)
        self.u_std = self.U.std(0) + _EPS

        # Text embeddings power the semantic diversity term + explanations.
        self.text = _l2norm(text_emb.astype(np.float32))

    # ---- taste-fit satisfaction (spec §10.1 proxy) ------------------- #
    def member_satisfaction(self, members: Sequence[int],
                            movie_idxs: Sequence[int]) -> np.ndarray:
        """Per-member taste fit in [0, 1] = percentile of the predicted rating
        within that member's *own* predicted-rating distribution over the catalog.

        Absolute MovieLens ratings are dominated by a movie's popularity, so every
        member predicts ~the same and there is no fairness tension. Ranking each
        movie inside the member's own preference distribution isolates *taste fit*:
        a niche film is top-percentile for the member who loves that niche and
        low-percentile for the others, so heterogeneous members genuinely disagree.
        This is method-independent (the reference is the catalog, not the pool), so
        it is comparable across methods. It is a proxy; held-out NDCG/Hit validate it.
        """
        members = np.asarray(members)
        movie_idxs = np.asarray(movie_idxs)
        full = self.mf.predict(members, np.arange(self.n_movies))   # [M, n_movies]
        sub = self.mf.predict(members, movie_idxs)                  # [M, len]
        sat = np.empty_like(sub, dtype=np.float32)
        for i in range(len(members)):
            order = np.sort(full[i])
            sat[i] = np.searchsorted(order, sub[i], side="right") / len(order)
        return sat

    # ---- group aggregation (spec §8) --------------------------------- #
    def group_centroid_raw(self, user_idxs: Sequence[int],
                           weights: Optional[np.ndarray] = None) -> np.ndarray:
        U = self.U[np.asarray(user_idxs)]
        if weights is None:
            return U.mean(0)
        w = np.asarray(weights, dtype=np.float32)
        return (U * w[:, None]).sum(0) / (w.sum() + _EPS)

    def group_cond_std(self, user_idxs: Sequence[int],
                       weights: Optional[np.ndarray] = None) -> np.ndarray:
        centroid = self.group_centroid_raw(user_idxs, weights)
        return ((centroid - self.u_mean) / self.u_std).astype(np.float32)

    # ---- traditional candidate generator ----------------------------- #
    def nn_candidates(self, user_idxs: Sequence[int], pool_size: int,
                      exclude: Optional[set] = None,
                      weights: Optional[np.ndarray] = None) -> List[int]:
        """Top movies by dot-product relevance to the group centroid (raw MF)."""
        g = self.group_centroid_raw(user_idxs, weights)
        scores = self.M @ g + self.mf.movie_bias            # [n_movies]
        order = np.argsort(-scores)
        return self._take(order, pool_size, exclude)

    # ---- generative candidate generator ------------------------------ #
    def diffusion_candidates(self, diff: GroupDiffusion, user_idxs: Sequence[int],
                             pool_size: int, exclude: Optional[set] = None,
                             weights: Optional[np.ndarray] = None,
                             neighbours_per_sample: int = 5) -> List[int]:
        """Sample embeddings from the denoiser, map each to nearest real movies."""
        cond = self.group_cond_std(user_idxs, weights)[None, :]   # [1, k]
        cond_t = torch.as_tensor(cond, device=diff.accel.device)
        gen = diff.ddim_sample(
            cond_t, n_samples=self.cfg.diff_num_candidates,
            steps=self.cfg.diff_sampling_steps, guidance=self.cfg.diff_guidance,
        )[0].detach().cpu().numpy()                                # [N, k]
        gen = _l2norm(gen)

        sims = gen @ self.Zn.T                                     # [N, n_movies]
        # Take the top neighbours of each generated point, score by best cosine.
        topn = np.argpartition(-sims, neighbours_per_sample, axis=1)[:, :neighbours_per_sample]
        best = {}
        for i in range(sims.shape[0]):
            for j in topn[i]:
                s = float(sims[i, j])
                if s > best.get(j, -2.0):
                    best[j] = s
        order = np.array(sorted(best, key=lambda m: -best[m]), dtype=np.int64)
        return self._take(order, pool_size, exclude)

    # ---- helper ------------------------------------------------------ #
    @staticmethod
    def _take(order: np.ndarray, pool_size: int, exclude: Optional[set]) -> List[int]:
        out: List[int] = []
        exclude = exclude or set()
        for m in order:
            mi = int(m)
            if mi in exclude:
                continue
            out.append(mi)
            if len(out) >= pool_size:
                break
        return out


def build_diffusion_pairs(train_df: pd.DataFrame, space: CatalogSpace,
                          cfg: WatchWiseConfig) -> tuple:
    """(cond, target) pairs: a user's std latent + a movie they rated highly.

    Each high-rating event becomes one training example, so the denoiser learns
    the distribution of liked-movie embeddings conditioned on taste.
    """
    liked = train_df[train_df["rating"] >= cfg.relevant_threshold]
    if len(liked) < 1000:   # relax if the high-rating set is too small
        liked = train_df[train_df["rating"] >= 3.5]
    u_idx = liked["u_idx"].to_numpy()
    m_idx = liked["m_idx"].to_numpy()

    cond = (space.U[u_idx] - space.u_mean) / space.u_std
    target = space.Z[m_idx]
    print(f"[diffusion] {len(cond):,} (taste, liked-movie) training pairs")
    return cond.astype(np.float32), target.astype(np.float32)
