"""Conditional diffusion candidate generator (spec §9, §12.2).

A small DDPM-style MLP denoiser that learns the distribution of *liked-movie*
embeddings **conditioned on a taste vector**. Training pairs are
``(cond = a user's latent, x0 = a movie that user rated highly)``; the network
learns ``p(liked-movie-embedding | taste)``. At inference we condition on a whole
group's aggregated taste vector and sample candidate embeddings, then map each to
the nearest real movie.

Why this beats nearest-neighbour for *groups*: NN retrieval returns the items most
relevant to the averaged taste vector, which tends to track the dominant sub-taste.
The denoiser samples from a learned (often multi-modal) manifold of liked items, so
it can propose genuine "in-between" compromise movies and cover minority tastes that
a single relevance ranking misses.

Extras for quality: cosine noise schedule, sinusoidal time embedding, DDIM
sampling (fewer steps than T), and classifier-free guidance to sharpen conditioning.
Everything routes through the :class:`~watchwise.accelerator.Accelerator`.
"""
from __future__ import annotations

import math
from typing import Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset

from ..accelerator import Accelerator
from ..config import WatchWiseConfig


# --------------------------------------------------------------------------- #
# Noise schedules                                                             #
# --------------------------------------------------------------------------- #
def cosine_beta_schedule(T: int, s: float = 0.008) -> torch.Tensor:
    """Nichol & Dhariwal cosine schedule — smoother sampling than linear."""
    steps = T + 1
    x = torch.linspace(0, T, steps)
    ac = torch.cos(((x / T) + s) / (1 + s) * math.pi * 0.5) ** 2
    ac = ac / ac[0]
    betas = 1 - (ac[1:] / ac[:-1])
    return torch.clip(betas, 1e-4, 0.999)


def linear_beta_schedule(T: int, beta_start: float, beta_end: float) -> torch.Tensor:
    return torch.linspace(beta_start, beta_end, T)


# --------------------------------------------------------------------------- #
# Denoiser network                                                            #
# --------------------------------------------------------------------------- #
class SinusoidalTimeEmbedding(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim

    def forward(self, t: torch.Tensor) -> torch.Tensor:
        half = self.dim // 2
        freqs = torch.exp(
            -math.log(10000) * torch.arange(half, device=t.device) / max(half - 1, 1)
        )
        args = t.float()[:, None] * freqs[None, :]
        emb = torch.cat([torch.sin(args), torch.cos(args)], dim=-1)
        if self.dim % 2:
            emb = F.pad(emb, (0, 1))
        return emb


class ConditionalDenoiser(nn.Module):
    """Predicts the noise added to ``x_t`` given the timestep and a taste cond."""

    def __init__(self, data_dim: int, cond_dim: int, hidden_dim: int,
                 num_layers: int, time_embed_dim: int):
        super().__init__()
        self.time_mlp = nn.Sequential(
            SinusoidalTimeEmbedding(time_embed_dim),
            nn.Linear(time_embed_dim, time_embed_dim), nn.SiLU(),
        )
        # Learned null condition for classifier-free guidance.
        self.null_cond = nn.Parameter(torch.zeros(cond_dim))

        in_dim = data_dim + cond_dim + time_embed_dim
        layers = [nn.Linear(in_dim, hidden_dim), nn.SiLU()]
        for _ in range(num_layers - 1):
            layers += [nn.Linear(hidden_dim, hidden_dim), nn.SiLU()]
        self.backbone = nn.Sequential(*layers)
        self.head = nn.Linear(hidden_dim, data_dim)

    def forward(self, x_t: torch.Tensor, t: torch.Tensor,
                cond: torch.Tensor) -> torch.Tensor:
        h = torch.cat([x_t, cond, self.time_mlp(t)], dim=-1)
        return self.head(self.backbone(h))


# --------------------------------------------------------------------------- #
# Diffusion process                                                           #
# --------------------------------------------------------------------------- #
class GroupDiffusion:
    """Holds the schedule + denoiser; provides training loss and DDIM sampling."""

    def __init__(self, denoiser: ConditionalDenoiser, cfg: WatchWiseConfig,
                 accel: Accelerator):
        self.cfg = cfg
        self.accel = accel
        self.T = cfg.diff_num_timesteps
        self.denoiser = accel.wrap(denoiser)

        if cfg.diff_beta_schedule == "cosine":
            betas = cosine_beta_schedule(self.T)
        else:
            betas = linear_beta_schedule(self.T, cfg.diff_beta_start, cfg.diff_beta_end)
        alphas = 1.0 - betas
        self.alpha_bar = torch.cumprod(alphas, dim=0).to(accel.device)
        self.betas = betas.to(accel.device)

    # ---- training ---------------------------------------------------- #
    def p_losses(self, x0: torch.Tensor, cond: torch.Tensor,
                 p_uncond: float = 0.1) -> torch.Tensor:
        b = x0.size(0)
        t = torch.randint(0, self.T, (b,), device=x0.device)
        noise = torch.randn_like(x0)
        ab = self.alpha_bar[t][:, None]
        x_t = ab.sqrt() * x0 + (1 - ab).sqrt() * noise

        # Classifier-free guidance: randomly drop the condition to the null token.
        drop = (torch.rand(b, device=x0.device) < p_uncond)[:, None]
        null = self.accel.unwrap(self.denoiser).null_cond
        cond_in = torch.where(drop, null.expand_as(cond), cond)

        pred = self.denoiser(x_t, t, cond_in)
        return F.mse_loss(pred, noise)

    # ---- sampling ---------------------------------------------------- #
    @torch.no_grad()
    def ddim_sample(self, cond: torch.Tensor, n_samples: int,
                    steps: int, guidance: float = 2.0) -> torch.Tensor:
        """Generate ``n_samples`` per condition row via DDIM with CFG.

        ``cond`` is [G, cond_dim]; returns [G, n_samples, data_dim].
        """
        self.denoiser.eval()
        G = cond.size(0)
        data_dim = self.accel.unwrap(self.denoiser).head.out_features
        cond_rep = cond.repeat_interleave(n_samples, dim=0)            # [G*n, c]
        null = self.accel.unwrap(self.denoiser).null_cond.expand_as(cond_rep)

        x = torch.randn(G * n_samples, data_dim, device=cond.device)
        ts = torch.linspace(self.T - 1, 0, steps).long().to(cond.device)

        for i in range(len(ts)):
            t = ts[i].expand(x.size(0))
            ab_t = self.alpha_bar[t][:, None]
            eps_c = self.denoiser(x, t, cond_rep)
            if guidance != 1.0:
                eps_u = self.denoiser(x, t, null)
                eps = eps_u + guidance * (eps_c - eps_u)
            else:
                eps = eps_c
            x0 = (x - (1 - ab_t).sqrt() * eps) / ab_t.sqrt().clamp_min(1e-8)
            if i < len(ts) - 1:
                t_next = ts[i + 1].expand(x.size(0))
                ab_n = self.alpha_bar[t_next][:, None]
                x = ab_n.sqrt() * x0 + (1 - ab_n).sqrt() * eps
            else:
                x = x0
            self.accel.mark_step()
        return x.view(G, n_samples, data_dim)


def save_diffusion(diff: "GroupDiffusion", path) -> None:
    raw = diff.accel.unwrap(diff.denoiser)
    torch.save({
        "state_dict": raw.state_dict(),
        "data_dim": raw.head.out_features,
        "cond_dim": raw.null_cond.numel(),
    }, path)


def load_diffusion(path, cfg: WatchWiseConfig, accel: Accelerator) -> "GroupDiffusion":
    ckpt = torch.load(path, map_location="cpu")
    denoiser = ConditionalDenoiser(
        data_dim=ckpt["data_dim"], cond_dim=ckpt["cond_dim"],
        hidden_dim=cfg.diff_hidden_dim, num_layers=cfg.diff_num_layers,
        time_embed_dim=cfg.diff_time_embed_dim,
    )
    denoiser.load_state_dict(ckpt["state_dict"])
    return GroupDiffusion(denoiser, cfg, accel)


def train_diffusion(cond_vectors: np.ndarray, target_vectors: np.ndarray,
                    cfg: WatchWiseConfig, accel: Accelerator) -> GroupDiffusion:
    """Train the denoiser on (cond, liked-movie-embedding) pairs."""
    data_dim = target_vectors.shape[1]
    cond_dim = cond_vectors.shape[1]
    denoiser = ConditionalDenoiser(
        data_dim=data_dim, cond_dim=cond_dim,
        hidden_dim=cfg.diff_hidden_dim, num_layers=cfg.diff_num_layers,
        time_embed_dim=cfg.diff_time_embed_dim,
    )
    diff = GroupDiffusion(denoiser, cfg, accel)
    opt = torch.optim.Adam(diff.denoiser.parameters(), lr=cfg.diff_lr)

    ds = TensorDataset(torch.as_tensor(target_vectors, dtype=torch.float32),
                       torch.as_tensor(cond_vectors, dtype=torch.float32))
    bs = accel.scale_batch_size(cfg.diff_batch_size)
    loader = DataLoader(ds, batch_size=bs, shuffle=True, num_workers=0)

    for epoch in range(cfg.diff_epochs):
        diff.denoiser.train()
        total, nb = 0.0, 0
        for x0, cond in loader:
            x0, cond = accel.to_device(x0), accel.to_device(cond)
            opt.zero_grad()
            loss = diff.p_losses(x0, cond)
            loss.backward()
            accel.step(opt)
            accel.mark_step()
            total += loss.item()
            nb += 1
        if epoch % 25 == 0 or epoch == cfg.diff_epochs - 1:
            print(f"  [diffusion] epoch {epoch:3d}  loss={total/max(nb,1):.4f}")
    return diff
