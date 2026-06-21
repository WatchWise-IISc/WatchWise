"""Stage 6 — non-circular evaluation, the 4-way comparison, and the w2 sweep.

Evaluates every method on the **held-out test groups** (the RL policy never saw
them), writes CSV/JSON results, renders figures, and emits a headline summary that
contrasts the traditional vs diffusion candidate generators and the bandit vs RL
rerankers.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from _bootstrap import parse_args  # noqa: E402
from watchwise.accelerator import Accelerator  # noqa: E402
from watchwise.candidates import CatalogSpace  # noqa: E402
from watchwise.config import get_config  # noqa: E402
from watchwise.evaluate import run_comparison, run_w2_sweep  # noqa: E402
from watchwise.groups import load_groups, split_groups  # noqa: E402
from watchwise.models.diffusion import load_diffusion  # noqa: E402
from watchwise.models.mf import MFArtifacts  # noqa: E402
from watchwise.models.rl import load_policy  # noqa: E402
from watchwise.pipeline import METHOD_LABELS, Recommender  # noqa: E402
from watchwise.utils import banner, save_json, set_seed, timer  # noqa: E402

PRETTY = {"avg_baseline": "Avg\nbaseline", "nn_greedy": "NN +\nbandit",
          "diffusion_greedy": "Diffusion\n+ bandit", "nn_rl": "NN +\nRL",
          "diffusion_rl": "Diffusion\n+ RL"}


def _figures(comp: pd.DataFrame, sweep: pd.DataFrame, cfg) -> None:
    rd = cfg.results_dir
    methods = list(PRETTY)

    # 1) Headline: worst-off member satisfaction on divergent groups.
    div = comp[comp["kind"] == "divergent"].set_index("method")
    fig, ax = plt.subplots(figsize=(8, 4.5))
    x = np.arange(len(methods))
    ax.bar(x - 0.2, [div.loc[m, "relevance"] for m in methods], 0.4,
           label="Mean relevance", color="#577590")
    ax.bar(x + 0.2, [div.loc[m, "min_member_sat"] for m in methods], 0.4,
           label="Min-member satisfaction (worst-off)", color="#e76f51")
    ax.set_xticks(x); ax.set_xticklabels([PRETTY[m] for m in methods])
    ax.set_ylabel("satisfaction (0-1)")
    ax.set_title("Divergent-taste groups: relevance vs worst-off member")
    ax.legend()
    fig.tight_layout(); fig.savefig(rd / "fig_min_member_by_method.png", dpi=130)
    plt.close(fig)

    # 2) Candidate-generation ablation (same reranker): NN vs Diffusion.
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    mets = ["min_member_sat", "group_ndcg", "group_hit", "diversity"]
    nn = [div.loc["nn_greedy", m] for m in mets]
    df = [div.loc["diffusion_greedy", m] for m in mets]
    x = np.arange(len(mets))
    ax.bar(x - 0.2, nn, 0.4, label="NN candidates", color="#577590")
    ax.bar(x + 0.2, df, 0.4, label="Diffusion candidates", color="#43aa8b")
    ax.set_xticks(x); ax.set_xticklabels(["min-member\nsat", "NDCG@5", "Hit@5", "diversity"])
    ax.set_title("Candidate generation (same fairness reranker, divergent groups)")
    ax.legend(); fig.tight_layout()
    fig.savefig(rd / "fig_candidate_generation.png", dpi=130); plt.close(fig)

    # 3) w2 fairness-vs-relevance trade-off curve.
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    ax.plot(sweep["w2"], sweep["relevance"], "o-", label="Mean relevance", color="#577590")
    ax.plot(sweep["w2"], sweep["min_member_sat"], "s-",
            label="Min-member satisfaction", color="#e76f51")
    ax.plot(sweep["w2"], sweep["fairness_gap"], "^--", label="Fairness gap (max-min)",
            color="#9c6644", alpha=0.7)
    ax.set_xlabel("w2 (weight on the worst-off member)")
    ax.set_ylabel("satisfaction (0-1)")
    ax.set_title("Fairness-vs-relevance trade-off (divergent groups, diffusion+bandit)")
    ax.legend(); fig.tight_layout()
    fig.savefig(rd / "fig_w2_sweep.png", dpi=130); plt.close(fig)

    # 4) Min-member satisfaction across group kinds.
    fig, ax = plt.subplots(figsize=(8, 4.2))
    kinds = ["random", "similar", "divergent"]
    width = 0.15
    for i, m in enumerate(methods):
        vals = [comp[(comp.method == m) & (comp.kind == kd)]["min_member_sat"].values[0]
                for kd in kinds]
        ax.bar(np.arange(len(kinds)) + (i - 2) * width, vals, width,
               label=METHOD_LABELS[m])
    ax.set_xticks(np.arange(len(kinds))); ax.set_xticklabels(kinds)
    ax.set_ylabel("min-member satisfaction")
    ax.set_title("Worst-off member by group difficulty")
    ax.legend(fontsize=7); fig.tight_layout()
    fig.savefig(rd / "fig_min_member_by_kind.png", dpi=130); plt.close(fig)
    print(f"  figures -> {rd}")


def _candidate_space_fig(rec, groups, cfg) -> None:
    """PCA of the movie-latent space showing where NN vs diffusion candidates land
    relative to each member's taste — visualises diffusion's middle-ground compromises."""
    from sklearn.decomposition import PCA
    from watchwise.evaluate import evaluate_slate
    from watchwise.groups import by_kind

    # Pick the most contrastive divergent test group (baseline strands someone most).
    div = by_kind([g for g in groups if g.split == "test"], "divergent")
    if not div:
        return
    div = sorted(div, key=lambda g: evaluate_slate(
        g, rec.recommend(g.members, "avg_baseline", seen=g.seen).slate,
        rec.mf, rec.space, cfg)["min_member_sat"])
    g = div[0]

    M = rec.mf.movie_factors
    pca = PCA(n_components=2, random_state=cfg.seed).fit(M)
    P = pca.transform(M)
    train = pd.read_parquet(cfg.cache_dir / "train_ratings.parquet")

    nn_pool = rec.space.nn_candidates(g.members, cfg.candidate_pool_size, set(g.seen))
    df_pool = rec.space.diffusion_candidates(rec.diff, g.members,
                                            cfg.candidate_pool_size, set(g.seen))

    fig, ax = plt.subplots(figsize=(7.5, 6))
    ax.scatter(P[:, 0], P[:, 1], s=3, c="#dddddd", label="catalog", zorder=1)
    colors = ["#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e"]
    for i, u in enumerate(g.members):
        fav = train.query("u_idx == @u and rating >= 4.0")["m_idx"].values
        if len(fav):
            ax.scatter(P[fav, 0], P[fav, 1], s=22, c=colors[i % len(colors)],
                       alpha=0.6, label=f"Member {i+1} likes", zorder=2)
    ax.scatter(P[nn_pool, 0], P[nn_pool, 1], s=45, marker="s",
               facecolors="none", edgecolors="#000000", linewidths=1.1,
               label="NN candidates", zorder=3)
    ax.scatter(P[df_pool, 0], P[df_pool, 1], s=55, marker="*",
               c="#e377c2", edgecolors="k", linewidths=0.4,
               label="Diffusion candidates", zorder=4)
    ax.set_title(f"Candidate space (divergent group #{g.gid}): diffusion fills the "
                 f"middle ground")
    ax.set_xlabel("movie-latent PC1"); ax.set_ylabel("movie-latent PC2")
    ax.legend(fontsize=7, loc="best")
    fig.tight_layout()
    fig.savefig(cfg.results_dir / "fig_candidate_space.png", dpi=130)
    plt.close(fig)
    print(f"  candidate-space figure -> {cfg.results_dir/'fig_candidate_space.png'}")


def _summary_md(comp: pd.DataFrame, sweep: pd.DataFrame, cfg, rl_stats) -> str:
    div = comp[comp["kind"] == "divergent"].set_index("method")
    cols = ["relevance", "min_member_sat", "fairness_gap", "group_ndcg",
            "group_hit", "diversity", "coverage"]
    lines = ["# WatchWise 2.0 — Evaluation Summary", "",
             f"Dataset **{cfg.dataset}**, {int(div['n_groups'].iloc[0])} divergent test groups, "
             f"K={cfg.slate_size}. Held-out NDCG/Hit are non-circular ground truth.", "",
             "## Divergent-taste groups (the headline)", "",
             "| Method | Relevance | Min-member | Fairness gap | NDCG@5 | Hit@5 | Diversity | Coverage |",
             "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for m in ["avg_baseline", "nn_greedy", "diffusion_greedy", "nn_rl", "diffusion_rl"]:
        r = div.loc[m]
        lines.append(f"| {METHOD_LABELS[m]} | {r.relevance:.3f} | **{r.min_member_sat:.3f}** "
                     f"| {r.fairness_gap:.3f} | {r.group_ndcg:.3f} | {r.group_hit:.3f} "
                     f"| {r.diversity:.3f} | {r.coverage:.3f} |")

    base = div.loc["avg_baseline"]
    best = div["min_member_sat"].idxmax()
    lift = div.loc[best, "min_member_sat"] - base.min_member_sat
    rel_change = div.loc[best, "relevance"] - base.relevance
    lines += ["", "## Read-out", "",
              f"- **Worst-off member lift:** best method `{METHOD_LABELS[best]}` raises "
              f"min-member satisfaction by **{lift:+.3f}** ({lift/max(base.min_member_sat,1e-6)*100:+.0f}%) "
              f"vs the average baseline, with a relevance change of {rel_change:+.3f}.",
              f"- **Candidate generation (NN vs diffusion, same reranker):** "
              f"min-member {div.loc['nn_greedy','min_member_sat']:.3f} -> "
              f"{div.loc['diffusion_greedy','min_member_sat']:.3f}, "
              f"diversity {div.loc['nn_greedy','diversity']:.3f} -> "
              f"{div.loc['diffusion_greedy','diversity']:.3f}, "
              f"coverage {div.loc['nn_greedy','coverage']:.3f} -> "
              f"{div.loc['diffusion_greedy','coverage']:.3f}.",
              f"- **Reranker (bandit vs RL, diffusion pool):** min-member "
              f"{div.loc['diffusion_greedy','min_member_sat']:.3f} -> "
              f"{div.loc['diffusion_rl','min_member_sat']:.3f}; "
              f"RL beats greedy on val groups: {rl_stats.get('rl_beats_greedy')}, "
              f"PPO contingency triggered: {rl_stats.get('ppo_contingency_triggered')}.",
              "", "## w2 sweep (fairness knob)", "",
              "| w2 | Relevance | Min-member | Fairness gap |",
              "| ---: | ---: | ---: | ---: |"]
    for _, row in sweep.iterrows():
        lines.append(f"| {row.w2:.2f} | {row.relevance:.3f} | {row.min_member_sat:.3f} "
                     f"| {row.fairness_gap:.3f} |")
    lines += ["", "Figures: `fig_min_member_by_method.png`, `fig_candidate_generation.png`, "
              "`fig_w2_sweep.png`, `fig_min_member_by_kind.png`.", ""]
    return "\n".join(lines)


def main() -> None:
    args = parse_args("Stage 6: evaluation + comparison + w2 sweep")
    cfg = get_config(args.phase)
    if args.seed is not None:
        cfg.seed = args.seed
    set_seed(cfg.seed)
    accel = Accelerator(args.accelerator, tpu_cores=cfg.tpu_cores)

    banner(f"STAGE 6 — EVALUATION  ({cfg.summary()})")

    mf = MFArtifacts.load(cfg.cache_dir / "mf.npz")
    text_emb = np.load(cfg.cache_dir / "text_embeddings.npy")
    space = CatalogSpace(mf, text_emb, cfg)
    catalog = pd.read_parquet(cfg.cache_dir / "catalog.parquet")
    diff = load_diffusion(cfg.cache_dir / "diffusion.pt", cfg, accel)
    policy = load_policy(cfg.cache_dir / "rl_policy.pt", accel)
    groups = load_groups(cfg.cache_dir / "groups.json")
    rec = Recommender(cfg, accel, mf, space, catalog, diff=diff, policy=policy)

    test_groups = split_groups(groups, "test")
    with timer(f"4-way comparison on {len(test_groups)} held-out test groups"):
        comp = run_comparison(rec, test_groups, cfg)
        comp.to_csv(cfg.results_dir / "comparison.csv", index=False)

    with timer("w2 fairness sweep (divergent groups)"):
        sweep = run_w2_sweep(rec, groups, cfg)
        sweep.to_csv(cfg.results_dir / "w2_sweep.csv", index=False)

    rl_stats = {}
    rl_stats_path = cfg.cache_dir / "rl_stats.json"
    if rl_stats_path.exists():
        import json
        rl_stats = json.loads(rl_stats_path.read_text())

    _figures(comp, sweep, cfg)
    try:
        _candidate_space_fig(rec, groups, cfg)
    except Exception as e:  # noqa: BLE001 - a viz failure shouldn't fail evaluation
        print(f"  (candidate-space figure skipped: {type(e).__name__}: {e})")
    summary = _summary_md(comp, sweep, cfg, rl_stats)
    (cfg.results_dir / "summary.md").write_text(summary)
    save_json(comp.to_dict(orient="records"), cfg.results_dir / "comparison.json")

    banner("STAGE 6 COMPLETE — divergent-group headline")
    div = comp[comp["kind"] == "divergent"].set_index("method")
    print(div[["relevance", "min_member_sat", "fairness_gap",
               "group_ndcg", "group_hit", "diversity"]].round(3).to_string())
    print(f"\n  full summary -> {cfg.results_dir/'summary.md'}")


if __name__ == "__main__":
    main()
