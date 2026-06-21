"""Stage 4 — synthetic group formation + held-out ground truth + group splits."""
from __future__ import annotations

import pandas as pd

from _bootstrap import parse_args
from watchwise.config import get_config
from watchwise.groups import form_groups, save_groups
from watchwise.models.mf import MFArtifacts
from watchwise.utils import banner, save_json, set_seed, timer


def main() -> None:
    args = parse_args("Stage 4: form synthetic groups")
    cfg = get_config(args.phase)
    if args.seed is not None:
        cfg.seed = args.seed
    set_seed(cfg.seed)

    banner(f"STAGE 4 — GROUP FORMATION  ({cfg.summary()})")

    mf = MFArtifacts.load(cfg.cache_dir / "mf.npz")
    train_df = pd.read_parquet(cfg.cache_dir / "train_ratings.parquet")
    test_df = pd.read_parquet(cfg.cache_dir / "test_ratings.parquet")

    with timer("form random/similar/divergent groups"):
        groups = form_groups(mf, train_df, test_df, cfg)
        save_groups(groups, cfg.cache_dir / "groups.json")

    sizes = [len(g.members) for g in groups]
    save_json({"n_groups": len(groups),
               "mean_group_size": sum(sizes) / len(sizes),
               "by_kind": pd.Series([g.kind for g in groups]).value_counts().to_dict(),
               "by_split": pd.Series([g.split for g in groups]).value_counts().to_dict()},
              cfg.cache_dir / "groups_stats.json")

    banner("STAGE 4 COMPLETE")
    print(f"  {len(groups)} groups; mean size {sum(sizes)/len(sizes):.1f}")


if __name__ == "__main__":
    main()
