"""Cold-start family profiles for Mode 3 (spec §15 — illustrative, NOT measured).

A brand-new family has no rating history, so there is nothing to hold out and
nothing to measure. We map each hand-authored member (a set of preferred genres)
to the **real MovieLens user whose taste best matches** those genres, then reuse
the normal pipeline. This is clearly an illustration of "the system still produces
a sensible compromise for a new family" — never a measured result.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import numpy as np
import pandas as pd


@dataclass
class ColdProfile:
    name: str
    genres: List[str]


# A few preset families for the demo dropdown.
PRESET_FAMILIES: Dict[str, List[ColdProfile]] = {
    "Action dad / Drama mom / Cartoon kid": [
        ColdProfile("Dad", ["Action", "Sci-Fi", "Thriller"]),
        ColdProfile("Mom", ["Drama", "Romance"]),
        ColdProfile("Child", ["Animation", "Children", "Comedy"]),
    ],
    "Horror teen / Rom-com parent / Adventure kid": [
        ColdProfile("Teen", ["Horror", "Thriller"]),
        ColdProfile("Parent", ["Romance", "Comedy"]),
        ColdProfile("Kid", ["Adventure", "Fantasy", "Animation"]),
    ],
    "Documentary grandpa / Musical grandma / Sci-Fi grandkid": [
        ColdProfile("Grandpa", ["Documentary", "War", "Drama"]),
        ColdProfile("Grandma", ["Musical", "Romance"]),
        ColdProfile("Grandkid", ["Sci-Fi", "Adventure"]),
    ],
}


def _user_genre_affinity(train_df: pd.DataFrame, movies: pd.DataFrame) -> pd.DataFrame:
    """Mean rating each user gives within each genre (from train ratings)."""
    g = movies[["m_idx", "genre_list"]].explode("genre_list").dropna()
    joined = train_df.merge(g, on="m_idx")
    return (joined.groupby(["u_idx", "genre_list"])["rating"].mean()
            .unstack(fill_value=0.0))


def map_profiles_to_users(profiles: List[ColdProfile], train_df: pd.DataFrame,
                          movies: pd.DataFrame) -> List[int]:
    """Pick a distinct proxy real user per profile by genre affinity."""
    affinity = _user_genre_affinity(train_df, movies)
    chosen: List[int] = []
    for prof in profiles:
        cols = [g for g in prof.genres if g in affinity.columns]
        score = affinity[cols].mean(axis=1) if cols else affinity.mean(axis=1)
        for u in score.sort_values(ascending=False).index:
            if int(u) not in chosen:
                chosen.append(int(u))
                break
    return chosen
