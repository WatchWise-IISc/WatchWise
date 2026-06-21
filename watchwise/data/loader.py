"""Load MovieLens, download on demand, and build contiguous id mappings.

MovieLens user/movie ids are sparse integers; matrix factorization needs dense
contiguous indices, so we build ``user2idx`` / ``movie2idx`` maps once and reuse
them everywhere (embeddings, groups, evaluation).
"""
from __future__ import annotations

import io
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import Dict

import numpy as np
import pandas as pd

from ..config import WatchWiseConfig


def download_movielens(cfg: WatchWiseConfig) -> None:
    """Download + unzip the configured MovieLens dataset if not already present."""
    if (cfg.dataset_dir / "ratings.csv").exists():
        return
    cfg.raw_dir.mkdir(parents=True, exist_ok=True)
    print(f"[data] downloading {cfg.dataset} from {cfg.dataset_url}")
    with urllib.request.urlopen(cfg.dataset_url, timeout=300) as resp:
        raw = resp.read()
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        zf.extractall(cfg.raw_dir)
    if not (cfg.dataset_dir / "ratings.csv").exists():
        raise FileNotFoundError(
            f"Expected {cfg.dataset_dir/'ratings.csv'} after extract; "
            f"check dataset name/url in config."
        )
    print(f"[data] extracted to {cfg.dataset_dir}")


@dataclass
class MovieLens:
    """Raw frames + dense index maps for one MovieLens dataset."""

    ratings: pd.DataFrame          # columns: userId, movieId, rating, timestamp, u_idx, m_idx
    movies: pd.DataFrame           # columns: movieId, title, genres, year, m_idx
    links: pd.DataFrame            # columns: movieId, imdbId, tmdbId
    tags: pd.DataFrame             # columns: userId, movieId, tag, timestamp (may be empty)
    user2idx: Dict[int, int]
    movie2idx: Dict[int, int]

    @property
    def n_users(self) -> int:
        return len(self.user2idx)

    @property
    def n_movies(self) -> int:
        return len(self.movie2idx)


def _parse_year(title: str):
    """Extract the trailing '(YYYY)' year MovieLens appends to titles."""
    import re
    m = re.search(r"\((\d{4})\)\s*$", str(title).strip())
    return int(m.group(1)) if m else np.nan


def load_movielens(cfg: WatchWiseConfig) -> MovieLens:
    download_movielens(cfg)
    d = cfg.dataset_dir

    ratings = pd.read_csv(d / "ratings.csv")
    movies = pd.read_csv(d / "movies.csv")
    links = pd.read_csv(d / "links.csv")
    tags_path = d / "tags.csv"
    tags = pd.read_csv(tags_path) if tags_path.exists() else pd.DataFrame(
        columns=["userId", "movieId", "tag", "timestamp"]
    )

    # Keep only movies that have at least one rating (the catalog the models see).
    rated_movies = set(ratings["movieId"].unique())
    movies = movies[movies["movieId"].isin(rated_movies)].reset_index(drop=True)
    ratings = ratings[ratings["movieId"].isin(set(movies["movieId"]))].reset_index(drop=True)

    movies["year"] = movies["title"].map(_parse_year)

    # Contiguous index maps (sorted for determinism).
    user_ids = sorted(ratings["userId"].unique())
    movie_ids = sorted(movies["movieId"].unique())
    user2idx = {int(u): i for i, u in enumerate(user_ids)}
    movie2idx = {int(m): i for i, m in enumerate(movie_ids)}

    ratings["u_idx"] = ratings["userId"].map(user2idx).astype(np.int64)
    ratings["m_idx"] = ratings["movieId"].map(movie2idx).astype(np.int64)
    movies["m_idx"] = movies["movieId"].map(movie2idx).astype(np.int64)
    movies = movies.sort_values("m_idx").reset_index(drop=True)

    print(f"[data] {cfg.dataset}: {len(ratings):,} ratings, "
          f"{len(user2idx):,} users, {len(movie2idx):,} movies, "
          f"{len(tags):,} tags")
    return MovieLens(ratings, movies, links, tags, user2idx, movie2idx)
