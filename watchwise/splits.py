"""Per-user rating holdout — the basis of non-circular evaluation (spec §3, §14).

We hold out a fraction of *each user's* ratings as a test set **before** training
matrix factorization. MF therefore never sees the held-out ratings, so its
predictions on them are genuine generalisation, not memorisation. Group
ground-truth = each member's held-out movies that they actually rated highly.
"""
from __future__ import annotations

from typing import Tuple

import numpy as np
import pandas as pd

from .config import WatchWiseConfig


def make_user_holdout(ratings: pd.DataFrame, cfg: WatchWiseConfig
                      ) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Split each user's ratings into (train, test).

    Users with fewer than ``min_ratings_per_user`` ratings keep all of their
    ratings in train (they are excluded from grouping/eval anyway). For the rest
    we hold out ``holdout_frac`` of their ratings uniformly at random.
    """
    rng = np.random.default_rng(cfg.seed)
    train_parts, test_parts = [], []

    for _, grp in ratings.groupby("userId", sort=True):
        n = len(grp)
        if n < cfg.min_ratings_per_user:
            train_parts.append(grp)
            continue
        n_test = max(1, int(round(n * cfg.holdout_frac)))
        idx = rng.permutation(n)
        test_idx = grp.index[idx[:n_test]]
        train_idx = grp.index[idx[n_test:]]
        test_parts.append(grp.loc[test_idx])
        train_parts.append(grp.loc[train_idx])

    train = pd.concat(train_parts).sort_index().reset_index(drop=True)
    test = (pd.concat(test_parts).sort_index().reset_index(drop=True)
            if test_parts else ratings.iloc[0:0].copy())
    print(f"[split] train={len(train):,} test={len(test):,} "
          f"(holdout_frac={cfg.holdout_frac}, "
          f"{test['userId'].nunique() if len(test) else 0} users have held-out items)")
    return train, test
