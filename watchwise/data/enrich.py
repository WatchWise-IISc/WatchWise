"""Build the enriched movie catalog (spec §6.2, §7.2).

Two enrichment paths, selected automatically:

* **Real TMDb** — used when ``TMDB_API_KEY`` or ``TMDB_READ_ACCESS_TOKEN`` is set.
  Fetches runtime and OTT ``watch/providers`` metadata; batched with backoff and
  cached to parquet so training/app flows never call the API live (spec §6.4).
* **Deterministic offline fallback** — used when no key is present. Genres, year,
  popularity (rating count) and mean rating are **real MovieLens data**; runtime,
  certification and OTT availability are synthesised deterministically per
  ``movieId`` and **clearly labelled** via ``enrichment_source='offline_fallback'``
  (honesty commitment, spec §18.2). This keeps the offline app fully functional.

The measured science (Mode 1: diffusion vs NN, fairness) uses no OTT/runtime/age
filters, so the fallback only affects the *filtered* Mode 2 showcase, never the
held-out-ratings evaluation.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from ..config import PROVIDER_CACHE_MARKETS, ROOT, WatchWiseConfig
from .loader import MovieLens

# Map a coarse maturity tier -> cache-source certification label.
_CERT_BY_MARKET = {
    "provider_source_a": {"family": "U", "teen": "UA", "adult": "A"},
    "provider_source_b": {"family": "G", "teen": "PG-13", "adult": "R"},
}
_TEEN_MILD_LABEL = "PG"


def _load_local_env(cfg: WatchWiseConfig) -> None:
    """Load simple KEY=VALUE pairs from repo-local .env without adding a dependency."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _h(movie_id: int, salt: str) -> float:
    """Deterministic hash -> float in [0, 1), reproducible across machines."""
    digest = hashlib.md5(f"{salt}:{movie_id}".encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _fallback_runtime(movie_id: int, genres: List[str]) -> int:
    base = 100
    if {"Animation", "Children"} & set(genres):
        base = 92
    if {"Drama", "War", "Crime"} & set(genres):
        base = 125
    jitter = int(_h(movie_id, "rt") * 45) - 15      # +/- range
    return int(np.clip(base + jitter, 80, 195))


def _fallback_maturity_tier(movie_id: int, genres: List[str]) -> str:
    gset = set(genres)
    if gset & {"Animation", "Children"}:
        return "family"
    if gset & {"Horror"} or (gset & {"Crime", "Thriller", "War"} and _h(movie_id, "cert") > 0.4):
        return "adult"
    return "teen"


def _fallback_providers(movie_id: int, market_key: str) -> List[str]:
    """Assign 1-3 fallback platforms deterministically."""
    platforms = PROVIDER_CACHE_MARKETS[market_key].fallback_platforms
    n = 1 + int(_h(movie_id, f"nprov:{market_key}") * 3)   # 1..3
    # Rotate the start index by hash so different movies pick different platforms.
    start = int(_h(movie_id, f"prov:{market_key}") * len(platforms))
    return [platforms[(start + i) % len(platforms)] for i in range(n)]


def _real_tmdb_enrich(
    ml: MovieLens,
    cfg: WatchWiseConfig,
    api_key: Optional[str],
    read_access_token: Optional[str],
) -> pd.DataFrame:
    """Fetch real metadata from TMDb (batched, with backoff). Cached by caller."""
    import time
    import urllib.request

    base = "https://api.themoviedb.org/3"
    rows = []
    link_map = ml.links.set_index("movieId")["tmdbId"].to_dict()
    provider_markets = PROVIDER_CACHE_MARKETS

    def _url(path: str) -> str:
        url = f"{base}{path}"
        if api_key:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}api_key={api_key}"
        return url

    def _get(path: str):
        for attempt in range(5):
            try:
                headers = {"User-Agent": "WatchWise/2.0"}
                if read_access_token:
                    headers["Authorization"] = f"Bearer {read_access_token}"
                req = urllib.request.Request(_url(path), headers=headers)
                with urllib.request.urlopen(req, timeout=20) as r:
                    return json.loads(r.read())
            except Exception:  # noqa: BLE001
                time.sleep(2 ** attempt)
        return None

    for _, mv in ml.movies.iterrows():
        tmdb_id = link_map.get(mv["movieId"])
        rec = {"movieId": mv["movieId"]}
        if pd.notna(tmdb_id):
            det = _get(f"/movie/{int(tmdb_id)}")
            if det:
                rec["runtime"] = det.get("runtime")
                rec["popularity_tmdb"] = det.get("popularity")
            prov = _get(f"/movie/{int(tmdb_id)}/watch/providers")
            for market_key, market in provider_markets.items():
                entry = (
                    (prov or {}).get("results", {}).get(market.tmdb_market, {})
                    if prov else {}
                )
                names = [p["provider_name"] for p in entry.get("flatrate", [])]
                rec[f"providers_{market_key}"] = names
        rows.append(rec)
    return pd.DataFrame(rows)


def build_catalog(ml: MovieLens, cfg: WatchWiseConfig) -> pd.DataFrame:
    """Assemble the enriched catalog, ordered by ``m_idx``."""
    _load_local_env(cfg)
    api_key = os.environ.get("TMDB_API_KEY")
    read_access_token = os.environ.get("TMDB_READ_ACCESS_TOKEN")
    movies = ml.movies.copy()

    # --- real popularity signals from MovieLens ratings (genuine) ---------- #
    agg = ml.ratings.groupby("movieId")["rating"].agg(["count", "mean"]).rename(
        columns={"count": "num_ratings", "mean": "mean_rating"})
    movies = movies.merge(agg, on="movieId", how="left")
    movies["num_ratings"] = movies["num_ratings"].fillna(0).astype(int)
    movies["mean_rating"] = movies["mean_rating"].fillna(movies["mean_rating"].mean())
    movies["genre_list"] = movies["genres"].str.split("|").apply(
        lambda gs: [g for g in gs if g and g != "(no genres listed)"])

    real_df = None
    source = "offline_fallback"
    if api_key or read_access_token:
        try:
            print("[enrich] TMDb credentials found -> fetching real TMDb metadata "
                  "(batched, cached). This runs once.")
            real_df = _real_tmdb_enrich(ml, cfg, api_key, read_access_token)
            source = "tmdb"
        except Exception as e:  # noqa: BLE001
            print(f"[enrich] TMDb fetch failed ({e}); using offline fallback.")
            real_df = None
    else:
        print("[enrich] No TMDb credentials -> deterministic OFFLINE FALLBACK for "
              "runtime/certification/OTT (labelled synthetic). "
              "Genres, year, popularity, mean rating are real MovieLens data.")

    real_map: Dict[int, dict] = {}
    if real_df is not None:
        real_map = {int(r["movieId"]): r for _, r in real_df.iterrows()}

    runtimes = []
    market_keys = list(PROVIDER_CACHE_MARKETS)
    certs = {market_key: [] for market_key in market_keys}
    providers = {market_key: [] for market_key in market_keys}
    sources = []

    for row in movies.itertuples(index=False):
        mid = int(row.movieId)
        glist = row.genre_list
        real = real_map.get(mid, {})
        row_source = source

        rt = real.get("runtime") if real else None
        if not rt or (isinstance(rt, float) and (np.isnan(rt) or rt <= 0)):
            rt = _fallback_runtime(mid, glist)
            if source == "tmdb":
                row_source = "tmdb+fallback"
        runtimes.append(int(rt))

        # maturity tier -> cache-source certification (always fallback-derived;
        # TMDb release_dates certifications are sparse, so we keep this uniform).
        tier = _fallback_maturity_tier(mid, glist)
        for market_key in market_keys:
            label = _CERT_BY_MARKET[market_key][tier]
            if market_key == "provider_source_b" and tier == "teen" and _h(mid, "mildpg") < 0.5:
                label = _TEEN_MILD_LABEL
            certs[market_key].append(label)

        # OTT providers per cache source
        for market_key in market_keys:
            p = real.get(f"providers_{market_key}") if real else None
            if not p:
                p = _fallback_providers(mid, market_key)
                if source == "tmdb":
                    row_source = "tmdb+fallback"
            providers[market_key].append(list(p))

        sources.append(row_source)

    movies["runtime"] = runtimes
    for market_key in market_keys:
        movies[f"cert_{market_key}"] = certs[market_key]
        # store provider lists as JSON strings for parquet friendliness
        movies[f"providers_{market_key}"] = [json.dumps(p) for p in providers[market_key]]
    movies["enrichment_source"] = sources
    movies["enrichment_date"] = cfg.enrichment_snapshot_date

    cols = ["m_idx", "movieId", "title", "year", "genres", "genre_list",
            "num_ratings", "mean_rating", "runtime"]
    cols += [f"cert_{market_key}" for market_key in market_keys]
    cols += [f"providers_{market_key}" for market_key in market_keys]
    cols += ["enrichment_source", "enrichment_date"]
    catalog = movies[cols].sort_values("m_idx").reset_index(drop=True)
    return catalog
