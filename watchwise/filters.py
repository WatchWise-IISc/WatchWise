"""Hard real-world filters for Mode 2 — applied BEFORE scoring.

OTT availability, runtime, and age are constraints, not learned signals: a movie
that fails any of them is removed from the candidate pool before the reranker sees
it. The product-facing path accepts only subscription, runtime, and age inputs.
Provider checks are evaluated across all cached provider columns.
"""
from __future__ import annotations

import json
from typing import List, Optional, Sequence, Set

import pandas as pd

from .config import (
    GLOBAL_FAMILY_SAFE_CERTS,
    GLOBAL_MAX_RUNTIME_MIN,
    GLOBAL_PROVIDER_ALIASES,
    GLOBAL_PROVIDERS,
    GLOBAL_TEEN_CERTS,
)


def _json_list(value) -> List[str]:
    if isinstance(value, str):
        return json.loads(value)
    return list(value) if value else []


def _all_provider_names(row: pd.Series) -> List[str]:
    columns = [c for c in row.index if c.startswith("providers_")]
    names: List[str] = []
    for col in columns:
        if col in row:
            names.extend(_json_list(row[col]))
    return names


def provider_aliases(providers: Optional[Sequence[str]] = None) -> Set[str]:
    selected = providers or GLOBAL_PROVIDERS
    aliases: Set[str] = set()
    for provider in selected:
        aliases.add(provider)
        aliases.update(GLOBAL_PROVIDER_ALIASES.get(provider, []))
    return aliases


def matching_provider_labels(row: pd.Series, providers: Sequence[str]) -> List[str]:
    available = set(_all_provider_names(row))
    labels = []
    for provider in providers:
        aliases = {provider, *GLOBAL_PROVIDER_ALIASES.get(provider, [])}
        if available & aliases:
            labels.append(provider)
    return labels


def _generic_certs(row: pd.Series) -> List[str]:
    columns = [c for c in row.index if c.startswith("cert_")]
    return [str(row[c]) for c in columns if c in row and pd.notna(row[c])]


def movie_passes(
    row: pd.Series,
    allow_teen: bool = True,
    providers: Optional[Sequence[str]] = None,
) -> bool:
    """True if a movie meets runtime, age, and selected-OTT constraints."""
    if not row["runtime"] or row["runtime"] > GLOBAL_MAX_RUNTIME_MIN:
        return False
    allowed = set(GLOBAL_FAMILY_SAFE_CERTS)
    if allow_teen:
        allowed |= set(GLOBAL_TEEN_CERTS)
    certs = set(_generic_certs(row))
    if certs and not (certs & allowed):
        return False
    available = set(_all_provider_names(row))
    selected = provider_aliases(providers)
    if len(available & selected) == 0:           # not streamable on selected platforms
        return False
    return True


def disallowed_movies(catalog: pd.DataFrame, allow_teen: bool = True,
                      providers: Optional[Sequence[str]] = None) -> Set[int]:
    """Set of ``m_idx`` to exclude from constrained candidates."""
    if providers is None:
        return set()
    mask = catalog.apply(
        lambda r: not movie_passes(r, allow_teen, providers),
        axis=1,
    )
    return set(catalog.loc[mask, "m_idx"].astype(int))


def constraint_match_rate(slate_rows: pd.DataFrame, allow_teen: bool = True,
                          providers: Optional[Sequence[str]] = None) -> float:
    """Fraction of a slate that satisfies the hard constraints (reporting)."""
    if len(slate_rows) == 0:
        return 0.0
    ok = slate_rows.apply(lambda r: movie_passes(r, allow_teen, providers), axis=1)
    return float(ok.mean())
