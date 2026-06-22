"""Hard real-world filters for Mode 2 (spec §15.1) — applied BEFORE scoring.

Availability/language/runtime/age are *constraints*, not learned signals: a movie
that fails any of them is removed from the candidate pool before the reranker sees
it. Filters are driven by a per-region config object, so the same engine serves any
geography (India is the primary instance, US the agnostic-design proof). Missing
certification is treated conservatively (excluded), per spec §7.2 item 6.
"""
from __future__ import annotations

import json
from typing import List, Optional, Set

import pandas as pd

from .config import RegionConfig, WatchWiseConfig


def _providers(row: pd.Series, region: RegionConfig) -> List[str]:
    return json.loads(row[f"providers_{region.watch_region}"])


def movie_passes(row: pd.Series, region: RegionConfig, allow_teen: bool = True) -> bool:
    """True if a movie meets the region's language/runtime/age/OTT constraints."""
    if row["original_language"] not in region.languages:
        return False
    if not row["runtime"] or row["runtime"] > region.max_runtime_min:
        return False
    cert = row[f"cert_{region.watch_region}"]
    allowed = set(region.family_safe_certs)
    if allow_teen:                               # add this region's older-teen tier
        allowed |= set(region.teen_certs)
    if cert not in allowed:
        return False
    if len(_providers(row, region)) == 0:        # not streamable on any allowlisted platform
        return False
    return True


def disallowed_movies(catalog: pd.DataFrame, region: Optional[RegionConfig],
                      allow_teen: bool = True) -> Set[int]:
    """Set of ``m_idx`` to exclude from candidates under a region (empty if Mode 1)."""
    if region is None:
        return set()
    mask = catalog.apply(lambda r: not movie_passes(r, region, allow_teen), axis=1)
    return set(catalog.loc[mask, "m_idx"].astype(int))


def constraint_match_rate(slate_rows: pd.DataFrame, region: RegionConfig,
                          allow_teen: bool = True) -> float:
    """Fraction of a slate that satisfies the region constraints (reporting)."""
    if len(slate_rows) == 0:
        return 0.0
    ok = slate_rows.apply(lambda r: movie_passes(r, region, allow_teen), axis=1)
    return float(ok.mean())
