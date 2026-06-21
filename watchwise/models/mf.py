"""Matrix factorization — member/movie embeddings (spec §8, §12.1).

A biased dot-product model: ``r_hat(u, m) = mu + b_u + b_m + <U_u, M_m>``. The
learned user/movie latent vectors live in a shared space where the dot product
approximates a rating; this is the space the diffusion generator and reranker
operate in. Device handling goes through :class:`~watchwise.accelerator.Accelerator`
so the identical code trains on CPU, MPS, CUDA (single/multi) and TPU.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from ..accelerator import Accelerator
from ..config import WatchWiseConfig

RATING_MIN, RATING_MAX = 0.5, 5.0


class MatrixFactorization(nn.Module):
    def __init__(self, n_users: int, n_movies: int, latent_dim: int, global_mean: float):
        super().__init__()
        self.user_emb = nn.Embedding(n_users, latent_dim)
        self.movie_emb = nn.Embedding(n_movies, latent_dim)
        self.user_bias = nn.Embedding(n_users, 1)
        self.movie_bias = nn.Embedding(n_movies, 1)
        self.global_bias = nn.Parameter(torch.tensor(float(global_mean)))
        # Small init keeps early predictions near the global mean.
        nn.init.normal_(self.user_emb.weight, std=0.05)
        nn.init.normal_(self.movie_emb.weight, std=0.05)
        nn.init.zeros_(self.user_bias.weight)
        nn.init.zeros_(self.movie_bias.weight)

    def forward(self, u: torch.Tensor, m: torch.Tensor) -> torch.Tensor:
        dot = (self.user_emb(u) * self.movie_emb(m)).sum(-1)
        return (self.global_bias + self.user_bias(u).squeeze(-1)
                + self.movie_bias(m).squeeze(-1) + dot)


@dataclass
class MFArtifacts:
    """Plain-numpy export of a trained MF model (what downstream stages consume)."""

    user_factors: np.ndarray     # [n_users, k]
    movie_factors: np.ndarray    # [n_movies, k]
    user_bias: np.ndarray        # [n_users]
    movie_bias: np.ndarray       # [n_movies]
    global_bias: float
    val_rmse: float

    def predict(self, u_idx, m_idx) -> np.ndarray:
        """Vectorised predicted rating(s); broadcasts u_idx against m_idx."""
        u_idx = np.atleast_1d(np.asarray(u_idx))
        m_idx = np.atleast_1d(np.asarray(m_idx))
        dot = self.movie_factors[m_idx] @ self.user_factors[u_idx].T  # [M, U]
        pred = (self.global_bias + self.user_bias[u_idx][None, :]
                + self.movie_bias[m_idx][:, None] + dot)              # [M, U]
        return np.clip(pred.T, RATING_MIN, RATING_MAX)                # [U, M]

    def save(self, path) -> None:
        np.savez(path, user_factors=self.user_factors, movie_factors=self.movie_factors,
                 user_bias=self.user_bias, movie_bias=self.movie_bias,
                 global_bias=np.float32(self.global_bias), val_rmse=np.float32(self.val_rmse))

    @classmethod
    def load(cls, path) -> "MFArtifacts":
        d = np.load(path)
        return cls(d["user_factors"], d["movie_factors"], d["user_bias"],
                   d["movie_bias"], float(d["global_bias"]), float(d["val_rmse"]))


def _loader(df: pd.DataFrame, batch_size: int, shuffle: bool) -> DataLoader:
    ds = TensorDataset(
        torch.as_tensor(df["u_idx"].to_numpy(), dtype=torch.long),
        torch.as_tensor(df["m_idx"].to_numpy(), dtype=torch.long),
        torch.as_tensor(df["rating"].to_numpy(), dtype=torch.float32),
    )
    return DataLoader(ds, batch_size=batch_size, shuffle=shuffle, num_workers=0)


def train_mf(train_df: pd.DataFrame, n_users: int, n_movies: int,
             cfg: WatchWiseConfig, accel: Accelerator,
             val_df: Optional[pd.DataFrame] = None) -> MFArtifacts:
    """Train MF on ``train_df`` only (never the held-out test set)."""
    # Carve a small validation slice off train for early stopping.
    if val_df is None:
        v = train_df.sample(frac=0.1, random_state=cfg.seed)
        t = train_df.drop(v.index)
    else:
        t, v = train_df, val_df

    model = MatrixFactorization(n_users, n_movies, cfg.mf_latent_dim,
                                float(train_df["rating"].mean()))
    model = accel.wrap(model)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.mf_lr,
                           weight_decay=cfg.mf_weight_decay)
    loss_fn = nn.MSELoss()

    bs = accel.scale_batch_size(cfg.mf_batch_size)
    train_loader = _loader(t, bs, shuffle=True)
    val_loader = _loader(v, bs, shuffle=False)

    best_rmse, best_state, patience, since = float("inf"), None, 5, 0
    for epoch in range(cfg.mf_epochs):
        model.train()
        for u, m, r in train_loader:
            u, m, r = accel.to_device(u), accel.to_device(m), accel.to_device(r)
            opt.zero_grad()
            loss = loss_fn(model(u, m), r)
            loss.backward()
            accel.step(opt)
            accel.mark_step()

        model.eval()
        se, n = 0.0, 0
        with torch.no_grad():
            for u, m, r in val_loader:
                u, m, r = accel.to_device(u), accel.to_device(m), accel.to_device(r)
                pred = model(u, m).clamp(RATING_MIN, RATING_MAX)
                se += ((pred - r) ** 2).sum().item()
                n += len(r)
                accel.mark_step()
        rmse = (se / max(n, 1)) ** 0.5
        if epoch % 5 == 0 or epoch == cfg.mf_epochs - 1:
            print(f"  [mf] epoch {epoch:3d}  val_rmse={rmse:.4f}")

        if rmse < best_rmse - 1e-4:
            best_rmse = rmse
            best_state = {k: val.detach().cpu().clone()
                          for k, val in accel.unwrap(model).state_dict().items()}
            since = 0
        else:
            since += 1
            if since >= patience:
                print(f"  [mf] early stop at epoch {epoch} (best val_rmse={best_rmse:.4f})")
                break

    raw = accel.unwrap(model)
    if best_state is not None:
        raw.load_state_dict(best_state)
    raw.eval()
    return MFArtifacts(
        user_factors=raw.user_emb.weight.detach().cpu().numpy().astype(np.float32),
        movie_factors=raw.movie_emb.weight.detach().cpu().numpy().astype(np.float32),
        user_bias=raw.user_bias.weight.detach().cpu().numpy().squeeze(-1).astype(np.float32),
        movie_bias=raw.movie_bias.weight.detach().cpu().numpy().squeeze(-1).astype(np.float32),
        global_bias=float(raw.global_bias.detach().cpu()),
        val_rmse=best_rmse,
    )
