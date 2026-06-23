"""Cold-start family profiles for Mode 3 (spec §15 — illustrative, NOT measured).

A brand-new family has no rating history, so there is nothing to hold out and
nothing to measure. We map each hand-authored member (a set of preferred genres)
to the **real MovieLens user who most specialises in** those genres, then reuse the
normal pipeline. This is clearly an illustration of "the system still produces a
sensible compromise for a new family" — never a measured result.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np
import pandas as pd

# A movie a user rated this high or above is treated as one they "love"; the proxy
# match is built from the genre make-up of each user's loved films, not raw means.
LOVE_THRESHOLD = 4.0


@dataclass
class ColdProfile:
    name: str
    genres: List[str]
    favorite_movie_ids: List[int] = field(default_factory=list)


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


def _loved_genre_profile(train_df: pd.DataFrame, movies: pd.DataFrame):
    """Per-user material for scoring genre specialisation.

    Returns ``(per_user, loved_long)`` where ``per_user`` carries each user's total
    rating count and loved-film count, and ``loved_long`` is one row per
    (user, loved movie, genre). Built from *loved* (>= ``LOVE_THRESHOLD``) films so
    the proxy reflects what a user actively enjoys, not what they merely rated.
    """
    n_rat = train_df.groupby("u_idx").size().rename("n_rat")
    loved = train_df.loc[train_df.rating >= LOVE_THRESHOLD, ["u_idx", "m_idx"]]
    n_loved = loved.groupby("u_idx").size().rename("n_loved")
    per_user = pd.concat([n_rat, n_loved], axis=1).dropna(subset=["n_rat"])
    per_user["n_loved"] = per_user["n_loved"].fillna(0)
    genres = movies[["m_idx", "genre_list"]].explode("genre_list").dropna()
    loved_long = loved.merge(genres, on="m_idx")        # (u_idx, m_idx, genre_list)
    return per_user, loved, loved_long


def map_profiles_to_users(profiles: List[ColdProfile], train_df: pd.DataFrame,
                          movies: pd.DataFrame, min_ratings: int = 30,
                          min_genre_hits: int = 5) -> List[int]:
    """Pick a distinct proxy real user per profile by **genre specialisation**.

    For each profile we rank users by the *share of their loved (>= 4 star) films
    that fall in the profile's genres*, gated by enough in-genre depth
    (``min_genre_hits``) and overall history (``min_ratings``) to give a stable MF
    latent. Tiered relaxation guarantees a distinct pick even for rare genres.

    The previous version scored users by *mean rating per genre*, which saturates at
    5.0 for any generous rater → hundreds of tied users → an essentially arbitrary,
    often sparse and off-taste proxy (e.g. a "cartoon kid" profile landing on an
    18-rating thriller fan). Specialisation + depth gating fixes that while staying
    fully offline and label-honest (still illustrative, never a measured result).
    """
    per_user, loved, loved_long = _loved_genre_profile(train_df, movies)
    # Prefer deep, specialised, well-rated users; each tier loosens a gate so a pick
    # always exists, even for sparse genres like Documentary/Musical.
    tiers = [(min_ratings, min_genre_hits), (min_ratings, 2),
             (min_ratings, 1), (10, 1), (0, 1)]

    chosen: List[int] = []
    for prof in profiles:
        genres = set(prof.genres)
        favorite_movie_ids = {
            int(m)
            for m in getattr(prof, "favorite_movie_ids", [])
            if pd.notna(m)
        }
        hits = (loved_long.loc[loved_long.genre_list.isin(genres)]
                .groupby("u_idx")["m_idx"].nunique())
        if favorite_movie_ids:
            favorite_hits = (loved.loc[loved.m_idx.isin(favorite_movie_ids)]
                             .groupby("u_idx")["m_idx"].nunique())
        else:
            favorite_hits = pd.Series(dtype=float)
        df = per_user.copy()
        df["hits"] = hits.reindex(df.index).fillna(0)
        df["favorite_hits"] = favorite_hits.reindex(df.index).fillna(0)
        df["interest_hits"] = df["hits"] + df["favorite_hits"]
        df["share"] = df["hits"] / df["n_loved"].where(df["n_loved"] > 0, np.nan)
        df["favorite_share"] = (
            df["favorite_hits"] / max(1, len(favorite_movie_ids))
            if favorite_movie_ids else 0.0
        )
        df["score"] = df["share"].fillna(0.0) + 1.5 * df["favorite_share"]
        df = df.sort_values(
            ["score", "favorite_hits", "share", "hits"],
            ascending=False,
        )  # favorite overlap, purity, then depth

        pick = None
        for mr, mh in tiers:
            elig = df.index[(df.n_rat >= mr) & (df.interest_hits >= mh)
                            & (~df.index.isin(chosen))]
            if len(elig):
                pick = int(elig[0])
                break
        if pick is None:                       # no in-genre history at all: any user
            pick = int(next(u for u in df.index if int(u) not in chosen))
        chosen.append(pick)
    return chosen
