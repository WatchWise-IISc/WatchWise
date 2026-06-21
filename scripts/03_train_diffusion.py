"""Stage 3 — conditional diffusion candidate generator.

Trains the DDPM-style denoiser on (taste, liked-movie-embedding) pairs derived
from the train split, and saves the checkpoint for candidate generation.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from _bootstrap import parse_args
from watchwise.accelerator import Accelerator
from watchwise.candidates import CatalogSpace, build_diffusion_pairs
from watchwise.config import get_config
from watchwise.models.diffusion import save_diffusion, train_diffusion
from watchwise.models.mf import MFArtifacts
from watchwise.utils import banner, save_json, set_seed, timer


def main() -> None:
    args = parse_args("Stage 3: train diffusion candidate generator")
    cfg = get_config(args.phase)
    if args.seed is not None:
        cfg.seed = args.seed
    set_seed(cfg.seed)
    accel = Accelerator(args.accelerator, tpu_cores=cfg.tpu_cores)

    banner(f"STAGE 3 — DIFFUSION CANDIDATE GENERATOR  ({cfg.summary()})")

    mf = MFArtifacts.load(cfg.cache_dir / "mf.npz")
    text_emb = np.load(cfg.cache_dir / "text_embeddings.npy")
    train_df = pd.read_parquet(cfg.cache_dir / "train_ratings.parquet")
    space = CatalogSpace(mf, text_emb, cfg)

    with timer("build (taste, liked-movie) pairs"):
        cond, target = build_diffusion_pairs(train_df, space, cfg)

    with timer(f"train denoiser (T={cfg.diff_num_timesteps}, "
               f"hidden={cfg.diff_hidden_dim}) on {accel.label}"):
        diff = train_diffusion(cond, target, cfg, accel)
        save_diffusion(diff, cfg.cache_dir / "diffusion.pt")

    save_json({"data_dim": int(target.shape[1]), "cond_dim": int(cond.shape[1]),
               "n_pairs": int(len(cond)), "T": cfg.diff_num_timesteps,
               "sampling_steps": cfg.diff_sampling_steps,
               "num_candidates": cfg.diff_num_candidates,
               "device": accel.label}, cfg.cache_dir / "diffusion_stats.json")

    banner("STAGE 3 COMPLETE")
    print(f"  trained on {len(cond):,} pairs; checkpoint -> {cfg.cache_dir/'diffusion.pt'}")


if __name__ == "__main__":
    main()
