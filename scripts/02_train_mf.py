"""Stage 2 — matrix factorization member/movie embeddings.

Creates the per-user holdout split (basis of non-circular evaluation), trains MF
on the train split only, and caches embeddings + the split for downstream stages.
"""
from __future__ import annotations

import json

import pandas as pd

from _bootstrap import parse_args
from watchwise.accelerator import Accelerator
from watchwise.config import get_config
from watchwise.models.mf import train_mf
from watchwise.splits import make_user_holdout
from watchwise.utils import banner, save_json, set_seed, timer


def main() -> None:
    args = parse_args("Stage 2: train MF embeddings")
    cfg = get_config(args.phase)
    if args.seed is not None:
        cfg.seed = args.seed
    set_seed(cfg.seed)
    accel = Accelerator(args.accelerator, tpu_cores=cfg.tpu_cores)

    banner(f"STAGE 2 — MATRIX FACTORIZATION  ({cfg.summary()})")

    ratings = pd.read_parquet(cfg.cache_dir / "ratings.parquet")
    id_maps = json.loads((cfg.cache_dir / "id_maps.json").read_text())
    n_users, n_movies = len(id_maps["user2idx"]), len(id_maps["movie2idx"])

    with timer("per-user holdout split"):
        train_df, test_df = make_user_holdout(ratings, cfg)
        train_df.to_parquet(cfg.cache_dir / "train_ratings.parquet", index=False)
        test_df.to_parquet(cfg.cache_dir / "test_ratings.parquet", index=False)

    with timer(f"train MF (k={cfg.mf_latent_dim}) on {accel.label}"):
        mf = train_mf(train_df, n_users, n_movies, cfg, accel)
        mf.save(cfg.cache_dir / "mf.npz")

    save_json({"val_rmse": mf.val_rmse, "latent_dim": cfg.mf_latent_dim,
               "n_users": n_users, "n_movies": n_movies,
               "device": accel.label}, cfg.cache_dir / "mf_stats.json")

    banner("STAGE 2 COMPLETE")
    print(f"  MF val RMSE = {mf.val_rmse:.4f}  (random-guess RMSE ~ 1.0+)")
    print(f"  user_factors {mf.user_factors.shape}  movie_factors {mf.movie_factors.shape}")


if __name__ == "__main__":
    main()
