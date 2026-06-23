"""DemoEngine with API-friendly return types (dicts instead of DataFrames/Markdown)."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
import torch

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from watchwise.accelerator import Accelerator
from watchwise.candidates import CatalogSpace
from watchwise.coldstart import PRESET_FAMILIES, ColdProfile, map_profiles_to_users
from watchwise.config import (
    GLOBAL_FAMILY_SAFE_CERTS,
    GLOBAL_MAX_RUNTIME_MIN,
    GLOBAL_PROVIDERS,
    GLOBAL_TEEN_CERTS,
    get_config,
)
from watchwise.evaluate import evaluate_slate
from watchwise.filters import matching_provider_labels, movie_passes
from watchwise.groups import load_groups, split_groups
from watchwise.models.diffusion import load_diffusion
from watchwise.models.mf import MFArtifacts
from watchwise.models.rl import load_policy
from watchwise.pipeline import METHOD_LABELS, Recommender

CURATED_DEMO_GROUPS = {
    "mode1": [
        1476,
        1641,
        1768,
        1684,
        1667,
    ],
    "mode2": [
        1792,
        1817,
        1758,
        1523,
        1944,
    ],
}

CURATED_MODE3_FAMILIES = [
    "Action dad / Drama mom / Cartoon kid",
]

CURATED_DEMO_LABELS = {
    "mode1": {
        1476: "Sci-fi adventure vs crime-drama duo",
        1641: "Indie drama vs action-comedy thriller pair",
        1768: "War auteur, fantasy action, and family-drama trio",
        1684: "IMAX action, crime drama, and animation quartet",
        1667: "Space adventure, period drama, and surreal comedy trio",
    },
    "mode2": {
        1792: "Romantic drama vs superhero sci-fi pair",
        1817: "Quirky sci-fi comedy vs legal action thriller pair",
        1758: "Groundhog Day comfort vs fantasy adventure pair",
        1523: "Taxi Driver grit vs Silver Linings dramedy pair",
        1944: "Horror, Hollywood satire, and classic romance ensemble",
    },
}


# --- Fuzzy title-search helpers (industry-standard pattern matching) ----------
# MovieLens titles carry a trailing "(year)" and invert leading articles
# ("Matrix, The (1999)"). We normalise both forms, index character trigrams for
# typo-tolerant candidate retrieval, then rank with a token-aware scorer that
# approximates rapidfuzz's token-set / partial-ratio behaviour without the dep.
_YEAR_RE = re.compile(r"\s*\((\d{4})\)\s*$")
_NONALNUM_RE = re.compile(r"[^a-z0-9]+")
_WS_RE = re.compile(r"\s+")
# Trailing articles MovieLens moves to the end, across the languages in the catalog.
_LEADING_ARTICLE_RE = re.compile(
    r"^(.*),\s+(the|a|an|le|la|les|el|los|las|il|lo|der|das|die|ein|eine|une|un|o|os|as)$",
    re.IGNORECASE,
)


def _normalise_text(text: str) -> str:
    """Lowercase, drop punctuation, collapse whitespace — the matchable form."""
    return _WS_RE.sub(" ", _NONALNUM_RE.sub(" ", str(text).lower())).strip()


def _strip_year(title: str) -> str:
    return _YEAR_RE.sub("", str(title)).strip()


def _deinvert_article(base: str) -> str:
    """'Matrix, The' -> 'The Matrix' so users can type the natural word order."""
    m = _LEADING_ARTICLE_RE.match(base)
    return f"{m.group(2)} {m.group(1)}" if m else base


def _char_trigrams(text: str) -> set:
    """Padded character trigrams (spaces removed) for fuzzy candidate retrieval."""
    padded = f"  {text.replace(' ', '')}  "
    return {padded[i : i + 3] for i in range(len(padded) - 2)}


def _token_match(a: str, b: str) -> float:
    """Best-effort similarity between two single tokens (0..1).

    Equality wins; an autocomplete-style prefix scores high; otherwise fall back
    to an edit-distance ratio, but only when both tokens are long enough so that
    short stop-words ('in', 'the', 'of') cannot inflate a spurious match.
    """
    if a == b:
        return 1.0
    if len(a) >= 3 and len(b) >= 3 and b.startswith(a):
        return 0.93  # query token is a prefix of the title token ("incep" -> "inception")
    if len(a) >= 4 and len(b) >= 4 and a.startswith(b):
        return 0.85  # title token is a prefix of the query token ("spiderman" -> "spider")
    r = SequenceMatcher(None, a, b).ratio()
    return r if r >= 0.72 else 0.0


class DemoEngine:
    """Loads every cached artifact once and answers demo queries."""

    def __init__(self, phase: str = "phase1"):
        self.cfg = get_config(phase)
        self.accel = Accelerator("cpu", verbose=False)
        self.mf = MFArtifacts.load(self.cfg.cache_dir / "mf.npz")
        text = np.load(self.cfg.cache_dir / "text_embeddings.npy")
        self.space = CatalogSpace(self.mf, text, self.cfg)
        self.catalog = pd.read_parquet(self.cfg.cache_dir / "catalog.parquet")
        self.catalog_by_idx = self.catalog.set_index("m_idx")
        self.train_df = pd.read_parquet(self.cfg.cache_dir / "train_ratings.parquet")
        self.diff = load_diffusion(self.cfg.cache_dir / "diffusion.pt", self.cfg, self.accel)
        self.policy = load_policy(self.cfg.cache_dir / "rl_policy.pt", self.accel)
        self.groups = load_groups(self.cfg.cache_dir / "groups.json")
        self.rec = Recommender(self.cfg, self.accel, self.mf, self.space,
                               self.catalog, diff=self.diff, policy=self.policy)
        self.test_groups = split_groups(self.groups, "test")
        self._gt = {g.gid: g for g in self.groups}
        self._contrast = self._rank_by_contrast()
        self._build_search_index()

    def _rank_by_contrast(self) -> dict:
        ranked = {}
        for kind in ("divergent", "similar", "random"):
            scored = []
            for g in [x for x in self.test_groups if x.kind == kind]:
                res = self.rec.recommend(g.members, "avg_baseline", seen=g.seen)
                m = evaluate_slate(g, res.slate, self.mf, self.space, self.cfg)
                scored.append({
                    "gid": g.gid,
                    "min_member_sat": m["min_member_sat"],
                    "hit5": m["group_hit"],
                    "ndcg5": m["group_ndcg"],
                    "worst_hit5": m["min_member_hit"],
                })
            scored.sort(key=lambda t: (t["hit5"], t["worst_hit5"], t["min_member_sat"], t["ndcg5"]))
            ranked[kind] = scored
        return ranked

    # ---- helpers --------------------------------------------------------- #
    def member_top_genres(self, u_idx: int, k: int = 3) -> str:
        hi = self.train_df[(self.train_df.u_idx == u_idx) & (self.train_df.rating >= 4.0)]
        g = (self.catalog_by_idx.loc[hi.m_idx.values, "genre_list"]
             if len(hi) else pd.Series([], dtype=object))
        flat = [x for sub in g for x in sub] if len(g) else []
        if not flat:
            return "eclectic"
        top = pd.Series(flat).value_counts().head(k).index.tolist()
        return ", ".join(top)

    def member_fav(self, u_idx: int) -> str:
        hi = self.train_df[(self.train_df.u_idx == u_idx)].sort_values("rating", ascending=False)
        if not len(hi):
            return ""
        return str(self.catalog_by_idx.loc[hi.iloc[0].m_idx, "title"])

    def group_choices(self, kind: str, mode: str = "mode1"):
        curated = [gid for gid in CURATED_DEMO_GROUPS.get(mode, []) if gid in self._gt]
        if curated:
            out = []
            for gid in curated:
                g = self._gt[gid]
                label = CURATED_DEMO_LABELS.get(mode, {}).get(gid, "Curated WatchWise cohort")
                out.append((f"{label} · {len(g.members)} viewers", gid))
            return out

        scored = self._contrast.get(kind, [])
        out = []
        for row in scored:
            gid = row["gid"]
            g = self._gt[gid]
            out.append((f"Group #{gid} · {len(g.members)} members · "
                        f"baseline Hit@5={row['hit5']:.2f} · "
                        f"floor={row['min_member_sat']:.2f}", gid))
        return out

    def available_genres(self) -> List[str]:
        genres = set()
        for raw in self.catalog["genre_list"]:
            if isinstance(raw, np.ndarray):
                raw = raw.tolist()
            if not isinstance(raw, list):
                raw = str(raw).replace("|", ",").split(",")
            genres.update(str(g).strip() for g in raw if str(g).strip())
        return sorted(genres)

    def _normalise_genres(self, genres: Optional[Sequence[str]]) -> List[str]:
        allowed = set(self.available_genres())
        out: List[str] = []
        for genre in genres or []:
            clean = str(genre).strip()
            if clean in allowed and clean not in out:
                out.append(clean)
        return out

    def _movie_payload(self, row) -> dict:
        genres = row.get("genre_list", [])
        if isinstance(genres, np.ndarray):
            genres = genres.tolist()
        if not isinstance(genres, list):
            genres = str(row.get("genres", "")).replace("|", ",").split(",")
        genres = [str(g).strip() for g in genres if str(g).strip()]
        year = row.get("year")
        m_idx = row.get("m_idx", row.name)
        return {
            "id": int(m_idx),
            "movieId": int(row["movieId"]),
            "title": str(row["title"]),
            "year": int(year) if pd.notna(year) else None,
            "genres": genres,
            "genre_text": ", ".join(genres),
            "num_ratings": int(row.get("num_ratings", 0)),
            "mean_rating": round(float(row.get("mean_rating", 0.0)), 2),
        }

    def movie_suggestions(
        self,
        genres: Optional[Sequence[str]] = None,
        limit: int = 6,
    ) -> dict:
        selected = self._normalise_genres(genres)
        selected_set = set(selected)
        df = self.catalog
        if selected_set:
            df = df[df["genre_list"].apply(lambda gs: bool(set(gs) & selected_set))]
        if df.empty:
            df = self.catalog

        limit = max(1, min(int(limit), 12))
        most_rated = df.sort_values(
            ["num_ratings", "mean_rating", "year"],
            ascending=[False, False, False],
        ).head(limit)
        newest = df.sort_values(
            ["year", "num_ratings", "mean_rating"],
            ascending=[False, False, False],
        ).head(limit)

        return {
            "genres": selected,
            "most_rated": [self._movie_payload(row) for _, row in most_rated.iterrows()],
            "newest": [self._movie_payload(row) for _, row in newest.iterrows()],
        }

    def _build_search_index(self) -> None:
        """Precompute the fuzzy title-search index once per loaded phase.

        Arrays are aligned by catalog row position. For every title we store the
        normalised form, the de-inverted form ('Matrix, The' -> 'the matrix'), its
        token set, its genre set, a popularity percentile (ranking prior), and a
        character-trigram inverted index for typo-tolerant candidate retrieval.
        """
        titles = self.catalog["title"].astype(str).tolist()
        self._sx_midx = self.catalog["m_idx"].astype(int).tolist()
        pop = (
            self.catalog["num_ratings"].fillna(0).astype(float)
            if "num_ratings" in self.catalog
            else pd.Series(np.zeros(len(titles)))
        )
        self._sx_pop_pct = pop.rank(pct=True).to_numpy()

        genre_lists = self.catalog["genre_list"].tolist()
        self._sx_norm: List[str] = []
        self._sx_deinv: List[str] = []
        self._sx_tokens: List[List[str]] = []
        self._sx_genres: List[set] = []
        tri_index: Dict[str, List[int]] = defaultdict(list)

        for pos, title in enumerate(titles):
            base = _strip_year(title)
            norm = _normalise_text(base)
            deinv = _normalise_text(_deinvert_article(base))
            self._sx_norm.append(norm)
            self._sx_deinv.append(deinv)
            self._sx_tokens.append(sorted(set(f"{norm} {deinv}".split())))

            gl = genre_lists[pos]
            if isinstance(gl, np.ndarray):
                gl = gl.tolist()
            if not isinstance(gl, list):
                gl = str(gl).replace("|", ",").split(",")
            self._sx_genres.append({str(g).strip() for g in gl if str(g).strip()})

            for gram in _char_trigrams(norm) | _char_trigrams(deinv):
                tri_index[gram].append(pos)

        self._sx_tri = dict(tri_index)

    def _title_relevance(
        self, q: str, qtokens: Sequence[str], pos: int
    ) -> Tuple[float, str]:
        """Relevance of one indexed title (0..1) and how it matched.

        Tiers, strongest first: exact title, prefix, substring, then a token-aware
        fuzzy score (mean best-match over query tokens) with a whole-string ratio
        as a floor. Both the normalised and de-inverted forms are considered.
        """
        norm = self._sx_norm[pos]
        deinv = self._sx_deinv[pos]
        best, mtype = 0.0, "fuzzy"

        for form in (norm, deinv):
            if q == form:
                return 1.0, "exact"
            if form.startswith(q):
                if 0.97 > best:
                    best, mtype = 0.97, "prefix"
            elif q in form:
                if 0.90 > best:
                    best, mtype = 0.90, "contains"

        tokens = self._sx_tokens[pos]
        if qtokens and tokens:
            coverage = sum(
                max((_token_match(a, b) for b in tokens), default=0.0) for a in qtokens
            ) / len(qtokens)
            if 0.93 * coverage > best:
                best, mtype = 0.93 * coverage, (mtype if mtype in ("prefix", "contains") else "fuzzy")
            whole = 0.82 * SequenceMatcher(None, q, norm).ratio()
            if whole > best:
                best, mtype = whole, "fuzzy"

        return best, mtype

    def search_movies(
        self,
        query: str,
        genres: Optional[Sequence[str]] = None,
        limit: int = 8,
    ) -> dict:
        raw = str(query or "").strip()
        selected = self._normalise_genres(genres)
        selected_set = set(selected)
        limit = max(1, min(int(limit), 12))

        def _empty(advice: str) -> dict:
            return {
                "query": raw,
                "available": False,
                "exact": False,
                "results": [],
                "note": None,
                "advice": advice,
                "fallback": self.movie_suggestions(selected, limit=min(limit, 6))["most_rated"],
            }

        if len(raw) < 2:
            return _empty("Type at least 2 characters to search the MovieLens catalog.")

        q = _normalise_text(raw)
        if not q:
            return _empty("Type at least 2 characters to search the MovieLens catalog.")
        qtokens = q.split()

        # Retrieve typo-tolerant candidates via shared character trigrams, then
        # guarantee every exact substring match is in the pool regardless of cap.
        qtri = _char_trigrams(q)
        overlap: Dict[int, int] = defaultdict(int)
        for gram in qtri:
            for pos in self._sx_tri.get(gram, ()):
                overlap[pos] += 1
        need = max(1, int(len(qtri) * 0.34))
        pool = {pos for pos, count in overlap.items() if count >= need}
        norms, deinvs = self._sx_norm, self._sx_deinv  # local refs for the hot scan
        for pos in range(len(norms)):
            if q in norms[pos] or q in deinvs[pos]:
                pool.add(pos)
        # Cap the expensive refine by trigram overlap (most-similar candidates first).
        candidates = sorted(pool, key=lambda p: overlap.get(p, 0), reverse=True)[:400]

        # Score: title relevance, then a small popularity prior that breaks near-ties
        # toward the real, popular film, then a tiny nudge for the member's genres.
        # Popularity must outweigh genre so a precise title query is never displaced.
        scored = []
        strong = False
        for pos in candidates:
            rel, mtype = self._title_relevance(q, qtokens, pos)
            if rel < 0.5:
                continue
            if rel >= 0.85:
                strong = True
            genre_bonus = 0.01 if (selected_set and (self._sx_genres[pos] & selected_set)) else 0.0
            rank = rel + 0.06 * float(self._sx_pop_pct[pos]) + genre_bonus
            scored.append((rank, rel, mtype, pos))
        scored.sort(key=lambda t: t[0], reverse=True)

        results = []
        for _, rel, mtype, pos in scored[:limit]:
            m_idx = self._sx_midx[pos]
            payload = self._movie_payload(self.catalog_by_idx.loc[m_idx])
            payload["score"] = round(float(rel), 3)
            payload["match_type"] = mtype
            results.append(payload)

        note = None
        advice = None
        if not results:
            advice = (
                "No close match in this MovieLens catalog. Pick a highly rated film "
                "from the selected favorite genres instead."
            )
        elif not strong:
            note = f"No exact title match — showing the closest films to “{raw}”."

        return {
            "query": raw,
            "available": bool(results),
            "exact": strong,
            "results": results,
            "note": note,
            "advice": advice,
            "fallback": self.movie_suggestions(selected, limit=min(limit, 6))["most_rated"] if not strong else [],
        }

    def _coerce_movie_ids(self, raw_items: Any) -> List[int]:
        if not raw_items:
            return []
        if not isinstance(raw_items, list):
            raw_items = [raw_items]
        movie_id_to_idx = {
            int(row.movieId): int(row.m_idx)
            for row in self.catalog[["movieId", "m_idx"]].itertuples(index=False)
        }
        valid_idx = set(int(x) for x in self.catalog_by_idx.index)
        out: List[int] = []
        for item in raw_items:
            raw = item
            if isinstance(item, dict):
                raw = item.get("id", item.get("m_idx", item.get("movieId")))
            try:
                mid = int(raw)
            except (TypeError, ValueError):
                continue
            if mid in valid_idx:
                m_idx = mid
            elif mid in movie_id_to_idx:
                m_idx = movie_id_to_idx[mid]
            else:
                continue
            if m_idx not in out:
                out.append(m_idx)
            if len(out) >= 3:
                break
        return out

    def _profiles_from_payload(self, profiles: List[dict]) -> List[ColdProfile]:
        if not profiles:
            profiles = [{"name": "Member 1", "genres": ["Comedy"]}]
        out: List[ColdProfile] = []
        for i, p in enumerate(profiles[:5]):
            name = str(p.get("name") or f"Member {i + 1}").strip() or f"Member {i + 1}"
            genres = self._normalise_genres(p.get("genres") or [])
            favorite_source = (
                p.get("favorite_movie_ids")
                or p.get("favoriteMovieIds")
                or p.get("favorite_movies")
                or p.get("favoriteMovies")
                or []
            )
            favorite_movie_ids = self._coerce_movie_ids(favorite_source)
            if not genres and favorite_movie_ids:
                inferred = set()
                for m_idx in favorite_movie_ids:
                    inferred.update(self._movie_genres(m_idx))
                genres = [g for g in self.available_genres() if g in inferred][:4]
            out.append(ColdProfile(name, genres, favorite_movie_ids))
        return out

    def custom_member_panel_data(
        self,
        profiles: Sequence[ColdProfile],
        members: Sequence[int],
        gid: str = "custom",
    ) -> dict:
        rows = []
        for i, (prof, u) in enumerate(zip(profiles, members), 1):
            favorite_titles = [
                str(self.catalog_by_idx.loc[m_idx, "title"])
                for m_idx in prof.favorite_movie_ids
                if m_idx in self.catalog_by_idx.index
            ]
            rows.append({
                "id": i,
                "name": prof.name,
                "u_idx": int(u),
                "proxy_user": int(u),
                "top_genres": ", ".join(prof.genres) if prof.genres else self.member_top_genres(u),
                "fav_movie": favorite_titles[0] if favorite_titles else self.member_fav(u),
                "favorite_movies": favorite_titles,
            })
        return {
            "gid": gid,
            "kind": "custom",
            "num_members": len(rows),
            "members": rows,
        }

    def member_panel_data(self, gid: int) -> dict:
        g = self._gt[gid]
        members = []
        for i, u in enumerate(g.members, 1):
            members.append({
                "id": i,
                "u_idx": u,
                "top_genres": self.member_top_genres(u),
                "fav_movie": self.member_fav(u),
            })
        return {
            "gid": gid,
            "kind": g.kind,
            "num_members": len(g.members),
            "members": members,
        }

    def _slate_data(
        self,
        slate,
        members,
        providers: Optional[Sequence[str]] = None,
    ) -> List[dict]:
        if not slate:
            return []
        pred = self.mf.predict(members, slate)               # 0.5-5 rating (display)
        # "Best for" uses within-member taste-fit (percentile of the predicted rating
        # in the member's own catalog distribution) — the same satisfaction signal the
        # reranker optimises — not the raw rating, which is popularity-dominated and
        # would credit a member with whichever movie is broadly popular, not the one
        # that actually fits their taste.
        sat = self.space.member_satisfaction(members, slate)
        best_for = sat.argmax(axis=1)
        rows = []
        for j, m in enumerate(slate):
            r = self.catalog_by_idx.loc[m]
            served = [f"M{i+1}" for i, b in enumerate(best_for) if b == j]
            row = {
                "id": int(m),
                "m_idx": int(m),
                "title": r["title"],
                "genres": r["genres"].replace("|", ", "),
                "group_pred": round(float(pred[:, j].mean()), 2),
                # Taste-fit satisfaction (percentile rank in each member's own
                # distribution) — the fairness signal the reranker optimises.
                # min = worst-off member's fit for THIS movie (the fair-compromise
                # signal); mean = average fit. The "ultimate fit" pick ranks on min.
                "min_member_sat": round(float(sat[:, j].min()), 3),
                "mean_member_sat": round(float(sat[:, j].mean()), 3),
                "best_for": served if served else [],
            }
            if providers:
                row["runtime"] = int(r["runtime"])
                row["cert"] = self._age_band(r)
                row["streams_on"] = matching_provider_labels(r, providers)
            rows.append(row)
        return rows

    def _member_slate_satisfaction(self, slate, members) -> List[float]:
        if not slate:
            return []
        sat = self.space.member_satisfaction(members, slate)
        return [round(float(x), 3) for x in sat.max(axis=1)]

    def _movie_genres(self, m_idx: int) -> set:
        row = self.catalog_by_idx.loc[m_idx]
        genres = row.get("genre_list", [])
        if isinstance(genres, np.ndarray):
            genres = genres.tolist()
        if isinstance(genres, list):
            return {str(g).strip() for g in genres if str(g).strip()}
        raw = str(row.get("genres", ""))
        return {g.strip() for g in raw.replace("|", ",").split(",") if g.strip()}

    def _profile_genre_sets(self, profiles: Sequence[ColdProfile]) -> List[set]:
        out = []
        for prof in profiles:
            genres = {str(g).strip() for g in prof.genres if str(g).strip()}
            for m_idx in getattr(prof, "favorite_movie_ids", []):
                if m_idx in self.catalog_by_idx.index:
                    genres.update(self._movie_genres(int(m_idx)))
            out.append(genres)
        return out

    def _coldstart_profile_fit(
        self,
        profiles: Sequence[ColdProfile],
        slate: Sequence[int],
    ) -> np.ndarray:
        """Declared-genre fit for each profile/movie in [0, 1].

        Mode 3 has no first-party ratings yet, so explicit onboarding genres must
        remain a first-class signal. This prevents globally loved proxy titles
        from crowding out the genres the user just selected.
        """
        profile_sets = self._profile_genre_sets(profiles)
        fit = np.zeros((len(profile_sets), len(slate)), dtype=np.float32)
        for j, m_idx in enumerate(slate):
            movie_genres = self._movie_genres(int(m_idx))
            for i, wanted in enumerate(profile_sets):
                overlap = len(movie_genres & wanted) if wanted else 0
                genre_fit = overlap / max(1, len(wanted)) if wanted else 0.0
                favorite_ids = [
                    int(m)
                    for m in getattr(profiles[i], "favorite_movie_ids", [])
                    if int(m) in self.catalog_by_idx.index
                ]
                favorite_fit = 0.0
                if favorite_ids:
                    sims = self.space.text[np.asarray(favorite_ids)] @ self.space.text[int(m_idx)]
                    favorite_fit = float(np.clip(np.max(sims), 0.0, 1.0))
                if wanted and favorite_ids:
                    fit[i, j] = 0.7 * genre_fit + 0.3 * favorite_fit
                elif favorite_ids:
                    fit[i, j] = favorite_fit
                else:
                    fit[i, j] = genre_fit
        return fit

    def _coldstart_composite_fit(
        self,
        members: Sequence[int],
        profiles: Sequence[ColdProfile],
        slate: Sequence[int],
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        profile_fit = self._coldstart_profile_fit(profiles, slate)
        proxy_sat = self.space.member_satisfaction(members, slate) if slate else profile_fit
        # Explicit genre intent dominates; proxy users supply the latent tie-break.
        composite = 0.68 * profile_fit + 0.32 * proxy_sat
        return profile_fit, proxy_sat, composite

    def _slate_diversity(self, slate: Sequence[int]) -> float:
        if len(slate) < 2:
            return 0.0
        vec = self.space.text[np.asarray(slate)]
        sim = vec @ vec.T
        iu = np.triu_indices(len(slate), k=1)
        return float(1.0 - sim[iu].mean())

    def _profile_grounded_hybrid_slate(
        self,
        members: Sequence[int],
        profiles: Sequence[ColdProfile],
        hybrid_pool: Sequence[int],
    ) -> List[int]:
        """Select a cold-start slate from the hybrid pool using declared intent.

        Candidate generation remains WatchWise hybrid (NN + diffusion). The extra
        Mode 3 step is a cold-start guardrail: keep only candidates that match at
        least one declared genre, then greedily maximize member coverage, worst-off
        profile fit, proxy satisfaction, and semantic diversity.
        """
        pool = []
        seen = set()
        for m in hybrid_pool:
            mi = int(m)
            if mi in seen:
                continue
            pool.append(mi)
            seen.add(mi)
        if not pool:
            return []

        profile_fit, proxy_sat, composite = self._coldstart_composite_fit(
            members,
            profiles,
            pool,
        )
        match_any = profile_fit.max(axis=0)
        eligible_idx = [i for i, v in enumerate(match_any) if v > 0.05]
        if len(eligible_idx) >= self.cfg.slate_size:
            pool = [pool[i] for i in eligible_idx]
            profile_fit = profile_fit[:, eligible_idx]
            proxy_sat = proxy_sat[:, eligible_idx]
            composite = composite[:, eligible_idx]
            match_any = match_any[eligible_idx]

        sim = self.space.text[np.asarray(pool)] @ self.space.text[np.asarray(pool)].T
        chosen: List[int] = []

        def objective(indices: List[int]) -> float:
            if not indices:
                return 0.0
            comp = composite[:, indices]
            pfit = profile_fit[:, indices]
            best = comp.max(axis=1)
            profile_best = pfit.max(axis=1)
            relevance = float(comp.mean())
            worst_off = float(best.min())
            profile_floor = float(profile_best.min())
            coverage = float(np.mean(profile_best > 0))
            avg_match = float(match_any[indices].mean())
            if len(indices) > 1:
                sub = sim[np.ix_(indices, indices)]
                iu = np.triu_indices(len(indices), k=1)
                diversity = float(1.0 - sub[iu].mean())
            else:
                diversity = 0.0
            return (
                1.15 * worst_off
                + 0.95 * profile_floor
                + 0.45 * coverage
                + 0.35 * relevance
                + 0.18 * diversity
                + 0.15 * avg_match
            )

        k = min(self.cfg.slate_size, len(pool))
        while len(chosen) < k:
            remaining = [i for i in range(len(pool)) if i not in chosen]
            best_idx = max(remaining, key=lambda i: objective(chosen + [i]))
            chosen.append(best_idx)
        return [pool[i] for i in chosen]

    def _coldstart_slate_data(
        self,
        slate: Sequence[int],
        members: Sequence[int],
        profiles: Sequence[ColdProfile],
        providers: Optional[Sequence[str]] = None,
    ) -> List[dict]:
        rows = self._slate_data(slate, members, providers=providers)
        if not rows:
            return rows
        profile_fit, _, composite = self._coldstart_composite_fit(members, profiles, slate)
        for j, row in enumerate(rows):
            row["min_member_sat"] = round(float(composite[:, j].min()), 3)
            row["mean_member_sat"] = round(float(composite[:, j].mean()), 3)
            row["profile_fit"] = round(float(profile_fit[:, j].max()), 3)
            row["best_for"] = [
                f"M{i + 1}"
                for i in range(len(profiles))
                if profile_fit[i, j] > 0
            ]
        return rows

    def _coldstart_metrics(
        self,
        slate: Sequence[int],
        members: Sequence[int],
        profiles: Sequence[ColdProfile],
    ) -> dict:
        if not slate:
            return {
                "relevance": 0.0,
                "min_member_sat": 0.0,
                "fairness_gap": 0.0,
                "diversity": 0.0,
                "profile_match": 0.0,
            }
        profile_fit, _, composite = self._coldstart_composite_fit(members, profiles, slate)
        best = composite.max(axis=1)
        return {
            "relevance": round(float(composite.mean()), 3),
            "min_member_sat": round(float(best.min()), 3),
            "fairness_gap": round(float(best.max() - best.min()), 3),
            "diversity": round(self._slate_diversity(slate), 3),
            "profile_match": round(float(profile_fit.max(axis=0).mean()), 3),
        }

    def _age_band(self, row) -> str:
        certs = {
            str(row[c])
            for c in row.index
            if c.startswith("cert_") and pd.notna(row[c])
        }
        if certs & set(GLOBAL_FAMILY_SAFE_CERTS):
            return "Family"
        if certs & set(GLOBAL_TEEN_CERTS):
            return "Teen"
        return "Restricted"

    def _selected_providers(self, providers: Optional[Sequence[str]]) -> List[str]:
        if not providers:
            return list(GLOBAL_PROVIDERS)
        allowed = set(GLOBAL_PROVIDERS)
        selected = []
        for provider in providers:
            clean = provider.strip()
            if clean in allowed and clean not in selected:
                selected.append(clean)
        return selected or list(GLOBAL_PROVIDERS)

    def _seed_recommendation(self, gid: int, method: str) -> None:
        method_offset = sum(ord(c) for c in method)
        seed = (self.cfg.seed + int(gid) * 1009 + method_offset) % (2**31 - 1)
        np.random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)

    # ---- Mode 1 ---------------------------------------------------------- #
    def run_mode1_api(self, gid: int) -> dict:
        g = self._gt[gid]
        methods = [
            "avg_baseline",
            "nn_greedy",
            "diffusion_greedy",
            "nn_rl",
            "diffusion_rl",
            "hybrid_rl",
        ]
        results = {}
        metrics = []
        for mth in methods:
            self._seed_recommendation(g.gid, mth)
            res = self.rec.recommend(g.members, mth, seen=g.seen)
            results[mth] = res
            m = evaluate_slate(g, res.slate, self.mf, self.space, self.cfg)
            metrics.append({
                "method": mth,
                "label": METHOD_LABELS[mth],
                "relevance": round(m["relevance"], 3),
                "min_member_sat": round(m["min_member_sat"], 3),
                "fairness_gap": round(m["fairness_gap"], 3),
                "ndcg5": round(m["group_ndcg"], 3),
                "hit5": round(m["group_hit"], 3),
                "worst_ndcg5": round(m["min_member_ndcg"], 3),
                "worst_hit5": round(m["min_member_hit"], 3),
                "diversity": round(m["diversity"], 3),
            })

        metric_by_method = {m["method"]: m for m in metrics}
        watchwise_method = max(
            ["diffusion_rl", "hybrid_rl"],
            key=lambda method: (
                metric_by_method[method]["hit5"],
                metric_by_method[method]["ndcg5"],
                metric_by_method[method]["min_member_sat"],
                -metric_by_method[method]["fairness_gap"],
            ),
        )
        baseline_slate = self._slate_data(results["avg_baseline"].slate, g.members)
        watchwise_slate = self._slate_data(results[watchwise_method].slate, g.members)

        # Diffusion candidate teaser
        pool = results["diffusion_greedy"].pool[:8]
        teaser = [self.catalog_by_idx.loc[m, "title"] for m in pool]

        return {
            "group": self.member_panel_data(gid),
            "baseline_slate": baseline_slate,
            "watchwise_slate": watchwise_slate,
            "watchwise_method": watchwise_method,
            "member_satisfaction": {
                "baseline": self._member_slate_satisfaction(
                    results["avg_baseline"].slate,
                    g.members,
                ),
                "watchwise": self._member_slate_satisfaction(
                    results[watchwise_method].slate,
                    g.members,
                ),
            },
            "metrics": metrics,
            "diffusion_teaser": teaser,
        }

    # ---- Mode 2 ---------------------------------------------------------- #
    def run_mode2_api(
        self,
        gid: int,
        allow_teen: bool,
        providers: Optional[Sequence[str]] = None,
    ) -> dict:
        selected_providers = self._selected_providers(providers)
        g = self._gt[gid]
        methods = ["avg_baseline", "diffusion_greedy", "diffusion_rl", "hybrid_rl"]
        results = {}
        metrics = {}
        for method in methods:
            self._seed_recommendation(g.gid, f"mode2_{method}")
            res = self.rec.recommend(
                g.members,
                method,
                seen=g.seen,
                allow_teen=allow_teen,
                providers=selected_providers,
            )
            results[method] = res
            metrics[method] = evaluate_slate(g, res.slate, self.mf, self.space, self.cfg)
        watchwise_method = max(
            ["diffusion_greedy", "diffusion_rl", "hybrid_rl"],
            key=lambda method: (
                metrics[method]["group_hit"],
                metrics[method]["group_ndcg"],
                metrics[method]["min_member_sat"],
                -metrics[method]["fairness_gap"],
            ),
        )
        baseline_res = results["avg_baseline"]
        watchwise_res = results[watchwise_method]
        baseline_slate = self._slate_data(
            baseline_res.slate,
            g.members,
            providers=selected_providers,
        )
        watchwise_slate = self._slate_data(
            watchwise_res.slate,
            g.members,
            providers=selected_providers,
        )

        def slate_match_rate(slate) -> float:
            if not slate:
                return 0.0
            rows = self.catalog_by_idx.loc[slate]
            return float(np.mean([
                movie_passes(r, allow_teen, selected_providers)
                for _, r in rows.iterrows()
            ]))

        baseline_match_rate = slate_match_rate(baseline_res.slate)
        watchwise_match_rate = slate_match_rate(watchwise_res.slate)

        return {
            "group": self.member_panel_data(gid),
            "slate": watchwise_slate,
            "baseline_slate": baseline_slate,
            "watchwise_slate": watchwise_slate,
            "watchwise_method": watchwise_method,
            "metrics": {
                method: {
                    "hit5": round(metrics[method]["group_hit"], 3),
                    "ndcg5": round(metrics[method]["group_ndcg"], 3),
                    "min_member_sat": round(metrics[method]["min_member_sat"], 3),
                    "fairness_gap": round(metrics[method]["fairness_gap"], 3),
                }
                for method in methods
            },
            "match_rate": watchwise_match_rate,
            "baseline_match_rate": baseline_match_rate,
            "watchwise_match_rate": watchwise_match_rate,
            "selected_providers": selected_providers,
            "constraints": {
                "providers": GLOBAL_PROVIDERS,
                "max_runtime": GLOBAL_MAX_RUNTIME_MIN,
                "family_safe_certs": GLOBAL_FAMILY_SAFE_CERTS,
                "teen_certs": GLOBAL_TEEN_CERTS,
            },
            "allow_teen": allow_teen,
            "snapshot_date": self.cfg.enrichment_snapshot_date,
        }

    # ---- Mode 3 ---------------------------------------------------------- #
    def _family_members_payload(
        self,
        profiles: Sequence[ColdProfile],
        members: Sequence[int],
    ) -> List[dict]:
        family_members = []
        for prof, u in zip(profiles, members):
            favorite_movies = [
                self._movie_payload(self.catalog_by_idx.loc[m_idx])
                for m_idx in getattr(prof, "favorite_movie_ids", [])
                if m_idx in self.catalog_by_idx.index
            ]
            family_members.append({
                "name": prof.name,
                "genres": prof.genres,
                "favorite_movies": favorite_movies,
                "proxy_user": int(u),
            })
        return family_members

    def _run_custom_profile_recommendation(
        self,
        profiles: List[dict],
        allow_teen: bool = True,
        providers: Optional[Sequence[str]] = None,
    ) -> dict:
        profs = self._profiles_from_payload(profiles)
        members = map_profiles_to_users(profs, self.train_df, self.catalog)
        selected_providers = self._selected_providers(providers) if providers is not None else None

        seen = set()
        for prof in profs:
            seen |= set(getattr(prof, "favorite_movie_ids", []))
        for u in members:
            seen |= set(self.train_df[self.train_df.u_idx == u].m_idx.tolist())

        baseline_res = self.rec.recommend(
            members,
            "avg_baseline",
            seen=sorted(seen),
            allow_teen=allow_teen,
            providers=selected_providers,
        )
        seed_source = "|".join(
            f"{p.name}:{','.join(sorted(p.genres))}:{','.join(map(str, p.favorite_movie_ids))}"
            for p in profs
        )
        family_seed = sum((i + 1) * ord(c) for i, c in enumerate(seed_source)) % 10000
        self._seed_recommendation(family_seed, "custom_hybrid_rl")
        res = self.rec.recommend(
            members,
            "hybrid_rl",
            seen=sorted(seen),
            allow_teen=allow_teen,
            providers=selected_providers,
        )
        grounded_slate = self._profile_grounded_hybrid_slate(
            members,
            profs,
            res.pool,
        )
        base_metrics = self._coldstart_metrics(baseline_res.slate, members, profs)
        watch_metrics = self._coldstart_metrics(grounded_slate, members, profs)
        baseline_slate = self._coldstart_slate_data(
            baseline_res.slate,
            members,
            profs,
            providers=selected_providers,
        )
        slate = self._coldstart_slate_data(
            grounded_slate,
            members,
            profs,
            providers=selected_providers,
        )

        return {
            "profiles": profs,
            "members": members,
            "family_members": self._family_members_payload(profs, members),
            "baseline_result": baseline_res,
            "watchwise_result": res,
            "baseline_slate": baseline_slate,
            "watchwise_slate": slate,
            "baseline_metrics": base_metrics,
            "watchwise_metrics": watch_metrics,
            "selected_providers": selected_providers,
        }

    def _custom_metric_rows(self, base_metrics: dict, watch_metrics: dict) -> List[dict]:
        return [
            {
                "method": "avg_baseline",
                "label": METHOD_LABELS["avg_baseline"],
                "relevance": base_metrics["relevance"],
                "min_member_sat": base_metrics["min_member_sat"],
                "fairness_gap": base_metrics["fairness_gap"],
                "ndcg5": None,
                "hit5": None,
                "worst_ndcg5": None,
                "worst_hit5": None,
                "diversity": base_metrics["diversity"],
                "profile_match": base_metrics.get("profile_match", 0.0),
            },
            {
                "method": "hybrid_profile_rl",
                "label": "Hybrid + profile gate",
                "relevance": watch_metrics["relevance"],
                "min_member_sat": watch_metrics["min_member_sat"],
                "fairness_gap": watch_metrics["fairness_gap"],
                "ndcg5": None,
                "hit5": None,
                "worst_ndcg5": None,
                "worst_hit5": None,
                "diversity": watch_metrics["diversity"],
                "profile_match": watch_metrics.get("profile_match", 0.0),
            },
        ]

    def run_mode1_custom_api(self, profiles: List[dict]) -> dict:
        data = self._run_custom_profile_recommendation(profiles)
        teaser = [
            self.catalog_by_idx.loc[m, "title"]
            for m in data["watchwise_result"].pool[:8]
        ]
        return {
            "custom": True,
            "cold_start": True,
            "family_name": "Custom group",
            "members": data["family_members"],
            "group": self.custom_member_panel_data(
                data["profiles"],
                data["members"],
                gid="custom",
            ),
            "baseline_slate": data["baseline_slate"],
            "watchwise_slate": data["watchwise_slate"],
            "watchwise_method": "hybrid_profile_rl",
            "watchwise_method_label": "Hybrid + profile gate",
            "metrics": self._custom_metric_rows(
                data["baseline_metrics"],
                data["watchwise_metrics"],
            ),
            "metric_note": "Custom groups have no historical holdout, so NDCG@5 and Hit@5 are not measured.",
            "diffusion_teaser": teaser,
        }

    def run_mode2_custom_api(
        self,
        profiles: List[dict],
        allow_teen: bool,
        providers: Optional[Sequence[str]] = None,
    ) -> dict:
        data = self._run_custom_profile_recommendation(
            profiles,
            allow_teen=allow_teen,
            providers=providers,
        )
        selected_providers = data["selected_providers"] or self._selected_providers(providers)

        def slate_match_rate(slate_rows) -> float:
            if not slate_rows:
                return 0.0
            return float(np.mean([
                movie_passes(
                    self.catalog_by_idx.loc[int(slate_row["m_idx"])],
                    allow_teen,
                    selected_providers,
                )
                for slate_row in slate_rows
            ]))

        baseline_match_rate = slate_match_rate(data["baseline_slate"])
        watchwise_match_rate = slate_match_rate(data["watchwise_slate"])
        watch_metrics = dict(data["watchwise_metrics"])
        base_metrics = dict(data["baseline_metrics"])
        watch_metrics.update({"hit5": None, "ndcg5": None})
        base_metrics.update({"hit5": None, "ndcg5": None})

        return {
            "custom": True,
            "cold_start": True,
            "family_name": "Custom group",
            "members": data["family_members"],
            "group": self.custom_member_panel_data(
                data["profiles"],
                data["members"],
                gid="custom",
            ),
            "slate": data["watchwise_slate"],
            "baseline_slate": data["baseline_slate"],
            "watchwise_slate": data["watchwise_slate"],
            "watchwise_method": "hybrid_profile_rl",
            "watchwise_method_label": "Hybrid + profile gate",
            "metrics": {
                "avg_baseline": base_metrics,
                "hybrid_profile_rl": watch_metrics,
                "watchwise": watch_metrics,
            },
            "metric_note": "Custom groups have no historical holdout, so NDCG@5 and Hit@5 are not measured.",
            "match_rate": watchwise_match_rate,
            "baseline_match_rate": baseline_match_rate,
            "watchwise_match_rate": watchwise_match_rate,
            "selected_providers": selected_providers,
            "constraints": {
                "providers": GLOBAL_PROVIDERS,
                "max_runtime": GLOBAL_MAX_RUNTIME_MIN,
                "family_safe_certs": GLOBAL_FAMILY_SAFE_CERTS,
                "teen_certs": GLOBAL_TEEN_CERTS,
            },
            "allow_teen": allow_teen,
            "snapshot_date": self.cfg.enrichment_snapshot_date,
        }

    def run_mode3_api(self, family_name: str) -> dict:
        profiles = PRESET_FAMILIES[family_name]
        members = map_profiles_to_users(profiles, self.train_df, self.catalog)
        seen = set()
        for u in members:
            seen |= set(self.train_df[self.train_df.u_idx == u].m_idx.tolist())
        baseline_res = self.rec.recommend(members, "avg_baseline", seen=sorted(seen))
        family_seed = sum((i + 1) * ord(c) for i, c in enumerate(family_name)) % 10000
        self._seed_recommendation(family_seed, "mode3_hybrid_rl")
        res = self.rec.recommend(members, "hybrid_rl", seen=sorted(seen))
        grounded_slate = self._profile_grounded_hybrid_slate(
            members,
            profiles,
            res.pool,
        )
        base_metrics = self._coldstart_metrics(baseline_res.slate, members, profiles)
        watch_metrics = self._coldstart_metrics(grounded_slate, members, profiles)
        baseline_slate = self._coldstart_slate_data(baseline_res.slate, members, profiles)
        slate = self._coldstart_slate_data(grounded_slate, members, profiles)

        family_members = []
        for prof, u in zip(profiles, members):
            family_members.append({
                "name": prof.name,
                "genres": prof.genres,
                "proxy_user": u,
            })

        return {
            "family_name": family_name,
            "members": family_members,
            "baseline_slate": baseline_slate,
            "slate": slate,
            "watchwise_method": "hybrid_profile_rl",
            "watchwise_method_label": "Hybrid + profile gate",
            "metrics": {
                "avg_baseline": base_metrics,
                "watchwise": watch_metrics,
            },
        }

    def run_mode3_custom_api(self, profiles: List[dict]) -> dict:
        """Run cold-start recommendation from a user-defined list of {name, genres}."""
        data = self._run_custom_profile_recommendation(profiles)
        return {
            "family_name": "Custom family",
            "members": data["family_members"],
            "baseline_slate": data["baseline_slate"],
            "slate": data["watchwise_slate"],
            "watchwise_method": "hybrid_profile_rl",
            "watchwise_method_label": "Hybrid + profile gate",
            "metrics": {
                "avg_baseline": data["baseline_metrics"],
                "watchwise": data["watchwise_metrics"],
            },
        }

    def _coldstart_proxy_group(self, family_name: str, members: List[int], seen: List[int]):
        from watchwise.groups import Group

        return Group(
            gid=sum((i + 1) * ord(c) for i, c in enumerate(family_name)) % 10000,
            kind="coldstart",
            split="demo",
            members=members,
            seen=seen,
            ground_truth={str(u): {} for u in members},
        )

    # ---- Summary --------------------------------------------------------- #
    def get_summary(self) -> dict:
        summary_path = self.cfg.results_dir / "comparison.json"
        w2_path = self.cfg.results_dir / "w2_sweep.csv"
        data = {}
        if summary_path.exists():
            with open(summary_path) as f:
                data["comparison"] = json.load(f)
        if w2_path.exists():
            w2_df = pd.read_csv(w2_path)
            data["w2_sweep"] = w2_df.to_dict(orient="records")
        return data
