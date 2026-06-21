"""WatchWise 2.0 — Family OTT Movie Recommender (Gradio demo, spec §15).

Runs entirely off cached artifacts and saved metrics — no live API calls. Three
modes share one engine:

* **Mode 1 — Platform-agnostic (measured):** the core science. Baseline vs
  WatchWise on a divergent-taste group, with the traditional-vs-diffusion contrast
  and the worst-off-member lift.
* **Mode 2 — Multilingual + OTT-aware (measured + filtered):** India / US region
  configs apply hard filters so every pick is watchable tonight.
* **Mode 3 — Cold-start family (illustrative, NOT measured):** hand-authored
  family mapped to proxy users.

Run:  python app/demo.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import gradio as gr  # noqa: E402

from watchwise.accelerator import Accelerator  # noqa: E402
from watchwise.candidates import CatalogSpace  # noqa: E402
from watchwise.coldstart import PRESET_FAMILIES, map_profiles_to_users  # noqa: E402
from watchwise.config import REGIONS, get_config  # noqa: E402
from watchwise.evaluate import evaluate_slate  # noqa: E402
from watchwise.filters import movie_passes  # noqa: E402
from watchwise.groups import by_kind, load_groups, split_groups  # noqa: E402
from watchwise.models.diffusion import load_diffusion  # noqa: E402
from watchwise.models.mf import MFArtifacts  # noqa: E402
from watchwise.models.rl import load_policy  # noqa: E402
from watchwise.pipeline import METHOD_LABELS, Recommender  # noqa: E402


class DemoEngine:
    """Loads every cached artifact once and answers demo queries."""

    def __init__(self, phase: str = "phase1"):
        self.cfg = get_config(phase)
        self.accel = Accelerator("cpu", verbose=False)   # CPU for reliable interactivity
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
        """Per kind, order test groups by how badly the naive baseline strands the
        worst-off member (largest fairness headroom first) so the demo lands on a
        compelling example rather than an already-easy group."""
        from watchwise.evaluate import evaluate_slate
        ranked = {}
        for kind in ("divergent", "similar", "random"):
            scored = []
            for g in [x for x in self.test_groups if x.kind == kind]:
                res = self.rec.recommend(g.members, "avg_baseline", seen=g.seen)
                m = evaluate_slate(g, res.slate, self.mf, self.space, self.cfg)
                scored.append((g.gid, m["min_member_sat"]))
            scored.sort(key=lambda t: t[1])           # most-stranded first
            ranked[kind] = scored
        return ranked

    # ---- member / movie rendering ------------------------------------ #
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
        # Test groups ordered so the most contrastive (baseline strands someone)
        # appear first — the demo's default lands on a compelling example.
        scored = self._contrast.get(kind, [])
        out = []
        for gid, base_min in scored:
            g = self._gt[gid]
            out.append((f"Group #{gid} · {len(g.members)} members · "
                        f"baseline worst-off={base_min:.2f}", gid))
        return out

    def member_panel(self, gid: int) -> str:
        g = self._gt[gid]
        rows = [f"**Group #{gid}** — *{g.kind}-taste*, {len(g.members)} members\n"]
        for i, u in enumerate(g.members, 1):
            rows.append(f"- **Member {i}** — likes *{self.member_top_genres(u)}*  "
                        f"· fav: _{self.member_fav(u)}_")
        return "\n".join(rows)

    def _slate_df(self, slate, members, region_code=None) -> pd.DataFrame:
        if not slate:
            return pd.DataFrame([{"(no movies)": "filters left nothing — relax constraints"}])
        pred = self.mf.predict(members, slate)             # [members, K]
        best_for = pred.argmax(axis=1)                     # member -> slate position
        rows = []
        for j, m in enumerate(slate):
            r = self.catalog_by_idx.loc[m]
            served = [f"M{i+1}" for i, b in enumerate(best_for) if b == j]
            row = {"Title": r["title"],
                   "Genres": r["genres"].replace("|", ", "),
                   "Group pred ★": round(float(pred[:, j].mean()), 2),
                   "Best for": ", ".join(served) if served else "-"}
            if region_code:
                reg = REGIONS[region_code]
                row["Language"] = r["original_language"]
                row["Runtime"] = f"{int(r['runtime'])}m"
                row["Cert"] = r[f"cert_{region_code}"]
                row["Streams on"] = ", ".join(json.loads(r[f"providers_{region_code}"]))
            rows.append(row)
        return pd.DataFrame(rows)

    # ---- Mode 1: measured comparison --------------------------------- #
    def run_mode1(self, gid: int):
        g = self._gt[gid]
        methods = ["avg_baseline", "nn_greedy", "diffusion_greedy", "diffusion_rl"]
        results, metric_rows = {}, []
        for mth in methods:
            res = self.rec.recommend(g.members, mth, seen=g.seen)
            results[mth] = res
            m = evaluate_slate(g, res.slate, self.mf, self.space, self.cfg)
            metric_rows.append({"Method": METHOD_LABELS[mth],
                                "Relevance": round(m["relevance"], 3),
                                "Min-member ↑": round(m["min_member_sat"], 3),
                                "Fairness gap ↓": round(m["fairness_gap"], 3),
                                "NDCG@5": round(m["group_ndcg"], 3),
                                "Hit@5": round(m["group_hit"], 3),
                                "Diversity": round(m["diversity"], 3)})
        metrics_df = pd.DataFrame(metric_rows)

        base_df = self._slate_df(results["avg_baseline"].slate, g.members)
        ww_df = self._slate_df(results["diffusion_rl"].slate, g.members)

        # diffusion candidate teaser (the generative step)
        pool = results["diffusion_greedy"].pool[:8]
        teaser = ", ".join(self.catalog_by_idx.loc[m, "title"] for m in pool)

        fig = self._bar_fig(metric_rows)
        note = (f"**Diffusion-generated compromise candidates (sample):** {teaser}\n\n"
                f"The average baseline maximises the *mean* and can strand the "
                f"worst-off member; WatchWise's `min`-aware reranker lifts them. "
                f"Compare the **Min-member ↑** column.")
        return self.member_panel(gid), base_df, ww_df, metrics_df, fig, note

    def _bar_fig(self, metric_rows):
        labels = [r["Method"].replace(" candidates", "").replace(" + ", "+\n")
                  for r in metric_rows]
        fig = go.Figure()
        fig.add_bar(name="Mean relevance", x=labels,
                    y=[r["Relevance"] for r in metric_rows], marker_color="#577590")
        fig.add_bar(name="Min-member (worst-off)", x=labels,
                    y=[r["Min-member ↑"] for r in metric_rows], marker_color="#e76f51")
        fig.update_layout(barmode="group", height=380,
                          title="Relevance vs worst-off member satisfaction",
                          yaxis_title="satisfaction (0-1)", legend=dict(orientation="h"))
        return fig

    # ---- Mode 2: OTT / language / age filtered ----------------------- #
    def run_mode2(self, gid: int, region_name: str, allow_teen: bool):
        code = "IN" if region_name.startswith("India") else "US"
        reg = REGIONS[code]
        g = self._gt[gid]
        res = self.rec.recommend(g.members, "diffusion_greedy", seen=g.seen,
                                 region=reg, allow_teen=allow_teen)
        df = self._slate_df(res.slate, g.members, region_code=code)
        if res.slate:
            rows = self.catalog_by_idx.loc[res.slate]
            ok = float(np.mean([movie_passes(r, reg, allow_teen) for _, r in rows.iterrows()]))
        else:
            ok = 0.0
        note = (f"**{reg.name}** · platforms: {', '.join(reg.platforms)} · "
                f"languages: {', '.join(reg.languages)} · runtime ≤ {reg.max_runtime_min}m · "
                f"family-safe certs: {', '.join(reg.family_safe_certs)}"
                f"{' (+teen)' if allow_teen else ''}.\n\n"
                f"Constraint-match rate: **{ok:.0%}** · availability as of "
                f"{self.cfg.enrichment_snapshot_date}. "
                f"*OTT/language/cert are offline-fallback labels in this build (real "
                f"TMDb data is used automatically when a TMDB_API_KEY is set).*")
        return self.member_panel(gid), df, note

    # ---- Mode 3: cold-start (illustrative) --------------------------- #
    def run_mode3(self, family_name: str):
        profiles = PRESET_FAMILIES[family_name]
        members = map_profiles_to_users(profiles, self.train_df, self.catalog)
        seen = set()
        for u in members:
            seen |= set(self.train_df[self.train_df.u_idx == u].m_idx.tolist())
        res = self.rec.recommend(members, "diffusion_rl", seen=sorted(seen))
        df = self._slate_df(res.slate, members)
        panel = "**Hand-authored family** (mapped to closest real-taste users):\n"
        for prof, u in zip(profiles, members):
            panel += f"- **{prof.name}** — wants *{', '.join(prof.genres)}* (proxy user {u})\n"
        note = ("⚠️ **Illustrative, NOT a measured result** (spec §15, §18.2). "
                "A brand-new family has no ratings to hold out, so this shows the "
                "engine still produces a sensible compromise — it is not part of the "
                "measured evaluation.")
        return panel, df, note


def build_ui(eng: DemoEngine):
    intro = (
        "# 🎬 WatchWise 2.0 — Family OTT Movie Recommender\n"
        "Fairness-aware **group** recommendation: a 3-5 movie watchlist the whole "
        "family is happy with — *protecting the member usually ignored*. Grounded in "
        "real MovieLens ratings; diffusion-generated compromise candidates vs "
        "traditional nearest-neighbour retrieval, picked by a fairness-aware reranker."
    )
    with gr.Blocks(title="WatchWise 2.0", theme=gr.themes.Soft()) as ui:
        gr.Markdown(intro)

        # ---- Mode 1 ---- #
        with gr.Tab("Mode 1 · Core science (measured)"):
            gr.Markdown("Pick a **divergent-taste** group and compare approaches. "
                        "Watch the **Min-member** column — that's the worst-off member.")
            with gr.Row():
                kind1 = gr.Dropdown(["divergent", "similar", "random"], value="divergent",
                                    label="Group difficulty")
                grp1 = gr.Dropdown(eng.group_choices("divergent"), label="Group")
            run1 = gr.Button("Recommend & compare", variant="primary")
            panel1 = gr.Markdown()
            with gr.Row():
                base1 = gr.Dataframe(label="❌ Average baseline (favours the majority)")
                ww1 = gr.Dataframe(label="✅ WatchWise (diffusion + RL)")
            metrics1 = gr.Dataframe(label="All approaches — measured on held-out ratings")
            plot1 = gr.Plot()
            note1 = gr.Markdown()

            kind1.change(lambda k: gr.update(choices=eng.group_choices(k),
                                             value=eng.group_choices(k)[0][1]),
                         kind1, grp1)
            run1.click(eng.run_mode1, grp1,
                       [panel1, base1, ww1, metrics1, plot1, note1])

        # ---- Mode 2 ---- #
        with gr.Tab("Mode 2 · OTT + language + age (filtered)"):
            gr.Markdown("Same engine, **hard filters** for what's streamable tonight.")
            with gr.Row():
                region2 = gr.Radio(["India (IN) — primary", "United States (US) — agnostic proof"],
                                   value="India (IN) — primary", label="Region")
                kind2 = gr.Dropdown(["divergent", "similar", "random"], value="divergent",
                                    label="Group difficulty")
                grp2 = gr.Dropdown(eng.group_choices("divergent"), label="Group")
                teen2 = gr.Checkbox(value=True, label="Allow older-teen ratings (UA/PG-13)")
            run2 = gr.Button("Recommend (filtered)", variant="primary")
            panel2 = gr.Markdown()
            slate2 = gr.Dataframe(label="Streamable family watchlist")
            note2 = gr.Markdown()
            kind2.change(lambda k: gr.update(choices=eng.group_choices(k),
                                             value=eng.group_choices(k)[0][1]),
                         kind2, grp2)
            run2.click(eng.run_mode2, [grp2, region2, teen2], [panel2, slate2, note2])

        # ---- Mode 3 ---- #
        with gr.Tab("Mode 3 · Cold-start family (illustrative)"):
            gr.Markdown("A **brand-new family** with no history — illustrative only.")
            fam3 = gr.Dropdown(list(PRESET_FAMILIES), value=list(PRESET_FAMILIES)[0],
                               label="Hand-authored family")
            run3 = gr.Button("Recommend for new family", variant="primary")
            panel3 = gr.Markdown()
            slate3 = gr.Dataframe(label="Compromise watchlist")
            note3 = gr.Markdown()
            run3.click(eng.run_mode3, fam3, [panel3, slate3, note3])

    return ui


if __name__ == "__main__":
    import argparse
    import os

    ap = argparse.ArgumentParser(description="WatchWise 2.0 demo")
    ap.add_argument("--phase", default=os.environ.get("WATCHWISE_PHASE", "phase1"),
                    choices=["phase1", "phase2"],
                    help="which cached phase's artifacts to demo (default: phase1)")
    ap.add_argument("--share", action="store_true",
                    help="create a public Gradio share link")
    args = ap.parse_args()

    print(f"[demo] loading cached artifacts (phase={args.phase}) ...")
    engine = DemoEngine(phase=args.phase)
    print("[demo] ready. launching Gradio ...")
    build_ui(engine).launch(server_name="0.0.0.0", show_error=True, share=args.share)
