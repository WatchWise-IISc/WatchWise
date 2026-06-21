"""Stage 1 — data backbone.

Downloads MovieLens, builds the enriched catalog (TMDb-or-fallback), computes
frozen text embeddings, and caches everything to ``data/cache/<dataset>/`` so no
later stage (or the demo) ever touches the network.
"""
from __future__ import annotations

import numpy as np

from _bootstrap import parse_args
from watchwise.config import get_config
from watchwise.data.enrich import build_catalog
from watchwise.data.loader import load_movielens
from watchwise.data.text_encoder import compute_text_embeddings
from watchwise.utils import banner, save_json, set_seed, timer


def main() -> None:
    args = parse_args("Stage 1: prepare data + enrichment + text features")
    cfg = get_config(args.phase)
    if args.seed is not None:
        cfg.seed = args.seed
    if args.no_text_encoder:
        cfg.use_text_encoder = False
    set_seed(cfg.seed)

    banner(f"STAGE 1 — DATA PREP  ({cfg.summary()})")

    with timer("load MovieLens"):
        ml = load_movielens(cfg)

    with timer("build enriched catalog"):
        catalog = build_catalog(ml, cfg)
        catalog.to_parquet(cfg.cache_dir / "catalog.parquet", index=False)
        ml.ratings.to_parquet(cfg.cache_dir / "ratings.parquet", index=False)

    with timer("compute frozen text embeddings"):
        text_emb, method = compute_text_embeddings(ml, cfg)
        np.save(cfg.cache_dir / "text_embeddings.npy", text_emb)

    # id maps so downstream stages don't re-derive them
    save_json(
        {"user2idx": {str(k): v for k, v in ml.user2idx.items()},
         "movie2idx": {str(k): v for k, v in ml.movie2idx.items()}},
        cfg.cache_dir / "id_maps.json",
    )
    save_json(
        {"dataset": cfg.dataset, "n_users": ml.n_users, "n_movies": ml.n_movies,
         "n_ratings": int(len(ml.ratings)), "text_method": method,
         "text_dim": int(text_emb.shape[1]),
         "enrichment_sources": catalog["enrichment_source"].value_counts().to_dict(),
         "language_counts": catalog["original_language"].value_counts().head(12).to_dict()},
        cfg.cache_dir / "data_stats.json",
    )

    banner("STAGE 1 COMPLETE")
    print(f"  users={ml.n_users:,} movies={ml.n_movies:,} ratings={len(ml.ratings):,}")
    print(f"  text method: {method}  (dim={text_emb.shape[1]})")
    print(f"  languages: {catalog['original_language'].value_counts().head(6).to_dict()}")
    print(f"  enrichment: {catalog['enrichment_source'].value_counts().to_dict()}")
    print(f"  cached to: {cfg.cache_dir}")


if __name__ == "__main__":
    main()
