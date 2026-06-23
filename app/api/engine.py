"""DemoEngine with API-friendly return types (dicts instead of DataFrames/Markdown)."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from watchwise.accelerator import Accelerator
from watchwise.candidates import CatalogSpace
from watchwise.coldstart import PRESET_FAMILIES, map_profiles_to_users
from watchwise.config import REGIONS, get_config
from watchwise.evaluate import evaluate_slate
from watchwise.filters import movie_passes
from watchwise.groups import load_groups, split_groups
from watchwise.models.diffusion import load_diffusion
from watchwise.models.mf import MFArtifacts
from watchwise.models.rl import load_policy
from watchwise.pipeline import METHOD_LABELS, Recommender


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

    def _rank_by_contrast(self) -> dict:
        ranked = {}
        for kind in ("divergent", "similar", "random"):
            scored = []
            for g in [x for x in self.test_groups if x.kind == kind]:
                res = self.rec.recommend(g.members, "avg_baseline", seen=g.seen)
                m = evaluate_slate(g, res.slate, self.mf, self.space, self.cfg)
                scored.append((g.gid, m["min_member_sat"]))
            scored.sort(key=lambda t: t[1])
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

    def group_choices(self, kind: str):
        scored = self._contrast.get(kind, [])
        out = []
        for gid, base_min in scored:
            g = self._gt[gid]
            out.append((f"Group #{gid} · {len(g.members)} members · "
                        f"baseline worst-off={base_min:.2f}", gid))
        return out

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
        region_code=None,
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
            if region_code:
                reg = REGIONS[region_code]
                row["language"] = r["original_language"]
                row["runtime"] = int(r["runtime"])
                row["cert"] = r[f"cert_{region_code}"]
                providers_raw = r.get(f"providers_{region_code}", "[]")
                if isinstance(providers_raw, str):
                    streams_on = json.loads(providers_raw)
                else:
                    streams_on = list(providers_raw) if providers_raw else []
                if providers:
                    selected = set(providers)
                    streams_on = [p for p in streams_on if p in selected]
                row["streams_on"] = streams_on
            rows.append(row)
        return rows

    def _selected_providers(self, reg, providers: Optional[Sequence[str]]) -> List[str]:
        if not providers:
            return list(reg.platforms)
        allowed = set(reg.platforms)
        selected = []
        for provider in providers:
            clean = provider.strip()
            if clean in allowed and clean not in selected:
                selected.append(clean)
        return selected or list(reg.platforms)

    # ---- Mode 1 ---------------------------------------------------------- #
    def run_mode1_api(self, gid: int) -> dict:
        g = self._gt[gid]
        methods = ["avg_baseline", "nn_greedy", "diffusion_greedy", "nn_rl", "diffusion_rl"]
        results = {}
        metrics = []
        for mth in methods:
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
                "diversity": round(m["diversity"], 3),
            })

        baseline_slate = self._slate_data(results["avg_baseline"].slate, g.members)
        watchwise_slate = self._slate_data(results["diffusion_rl"].slate, g.members)

        # Diffusion candidate teaser
        pool = results["diffusion_greedy"].pool[:8]
        teaser = [self.catalog_by_idx.loc[m, "title"] for m in pool]

        return {
            "group": self.member_panel_data(gid),
            "baseline_slate": baseline_slate,
            "watchwise_slate": watchwise_slate,
            "metrics": metrics,
            "diffusion_teaser": teaser,
        }

    # ---- Mode 2 ---------------------------------------------------------- #
    def run_mode2_api(
        self,
        gid: int,
        region_code: str,
        allow_teen: bool,
        providers: Optional[Sequence[str]] = None,
    ) -> dict:
        reg = REGIONS[region_code]
        selected_providers = self._selected_providers(reg, providers)
        g = self._gt[gid]
        baseline_res = self.rec.recommend(
            g.members,
            "avg_baseline",
            seen=g.seen,
            region=reg,
            allow_teen=allow_teen,
            providers=selected_providers,
        )
        watchwise_res = self.rec.recommend(
            g.members,
            "diffusion_greedy",
            seen=g.seen,
            region=reg,
            allow_teen=allow_teen,
            providers=selected_providers,
        )
        baseline_slate = self._slate_data(
            baseline_res.slate,
            g.members,
            region_code=region_code,
            providers=selected_providers,
        )
        watchwise_slate = self._slate_data(
            watchwise_res.slate,
            g.members,
            region_code=region_code,
            providers=selected_providers,
        )

        def slate_match_rate(slate) -> float:
            if not slate:
                return 0.0
            rows = self.catalog_by_idx.loc[slate]
            return float(np.mean([
                movie_passes(r, reg, allow_teen, selected_providers)
                for _, r in rows.iterrows()
            ]))

        baseline_match_rate = slate_match_rate(baseline_res.slate)
        watchwise_match_rate = slate_match_rate(watchwise_res.slate)

        return {
            "group": self.member_panel_data(gid),
            "slate": watchwise_slate,
            "baseline_slate": baseline_slate,
            "watchwise_slate": watchwise_slate,
            "match_rate": watchwise_match_rate,
            "baseline_match_rate": baseline_match_rate,
            "watchwise_match_rate": watchwise_match_rate,
            "selected_providers": selected_providers,
            "region": {
                "code": region_code,
                "name": reg.name,
                "platforms": reg.platforms,
                "languages": reg.languages,
                "max_runtime": reg.max_runtime_min,
                "family_safe_certs": reg.family_safe_certs,
                "teen_certs": reg.teen_certs,
                "rating_system": reg.rating_system,
            },
            "allow_teen": allow_teen,
            "snapshot_date": self.cfg.enrichment_snapshot_date,
        }

    # ---- Mode 3 ---------------------------------------------------------- #
    def run_mode3_api(self, family_name: str) -> dict:
        profiles = PRESET_FAMILIES[family_name]
        members = map_profiles_to_users(profiles, self.train_df, self.catalog)
        seen = set()
        for u in members:
            seen |= set(self.train_df[self.train_df.u_idx == u].m_idx.tolist())
        res = self.rec.recommend(members, "diffusion_rl", seen=sorted(seen))
        slate = self._slate_data(res.slate, members)

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
            "slate": slate,
        }

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
