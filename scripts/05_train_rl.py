"""Stage 5 — REINFORCE slate-builder.

Precomputes a diffusion candidate pool + reward model per *training/validation*
group (Mode 1, no hard filters — pure science), then trains the policy on the
train groups and reports reward on the held-out val groups. Disjoint group splits
keep the policy honest (spec §10.3). Runs a lightweight stability check (spec D11)
and flags whether PPO would be triggered.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from _bootstrap import parse_args
from watchwise.accelerator import Accelerator
from watchwise.candidates import CatalogSpace
from watchwise.config import get_config
from watchwise.groups import load_groups, split_groups
from watchwise.models.diffusion import load_diffusion
from watchwise.models.mf import MFArtifacts
from watchwise.models.rl import evaluate_policy, save_policy, train_rl
from watchwise.pipeline import Recommender
from watchwise.reward import build_reward_model
from watchwise.utils import banner, save_json, set_seed, timer


def _episodes_for(rec: Recommender, groups, cfg):
    eps = []
    for g in groups:
        exclude = set(g.seen)
        pool = rec.space.diffusion_candidates(rec.diff, g.members,
                                              cfg.candidate_pool_size, exclude)
        if len(pool) < cfg.slate_size:
            continue
        eps.append(rec.make_episode_for(g.members, pool))
    return eps


def main() -> None:
    args = parse_args("Stage 5: train RL slate-builder")
    cfg = get_config(args.phase)
    if args.seed is not None:
        cfg.seed = args.seed
    set_seed(cfg.seed)
    accel = Accelerator(args.accelerator, tpu_cores=cfg.tpu_cores)

    banner(f"STAGE 5 — RL SLATE-BUILDER  ({cfg.summary()})")

    mf = MFArtifacts.load(cfg.cache_dir / "mf.npz")
    text_emb = np.load(cfg.cache_dir / "text_embeddings.npy")
    space = CatalogSpace(mf, text_emb, cfg)
    diff = load_diffusion(cfg.cache_dir / "diffusion.pt", cfg, accel)
    groups = load_groups(cfg.cache_dir / "groups.json")
    rec = Recommender(cfg, accel, mf, space, catalog=None, diff=diff)

    with timer("precompute diffusion episodes (train/val groups)"):
        train_eps = _episodes_for(rec, split_groups(groups, "train"), cfg)
        val_eps = _episodes_for(rec, split_groups(groups, "val"), cfg)
        print(f"  train episodes={len(train_eps)}  val episodes={len(val_eps)}")

    # Baseline: greedy reward on val episodes (what RL must beat to justify itself).
    from watchwise.models.reranker import greedy_fairness_select
    greedy_val = float(np.mean([ep.rm.reward(greedy_fairness_select(ep.rm, cfg.slate_size))
                                for ep in val_eps]))

    with timer(f"train REINFORCE policy ({cfg.rl_episodes} episodes) on {accel.label}"):
        policy = train_rl(train_eps, cfg, accel, latent_dim=mf.movie_factors.shape[1],
                          val_eps=val_eps)
        save_policy(policy, cfg.cache_dir / "rl_policy.pt",
                    latent_dim=mf.movie_factors.shape[1], cfg=cfg)

    rl_val = evaluate_policy(policy, val_eps, cfg, accel)
    # Stability check (spec D11): does RL clear the greedy baseline on val groups?
    ppo_triggered = rl_val < greedy_val - 1e-3
    save_json({"greedy_val_reward": greedy_val, "rl_val_reward": rl_val,
               "rl_beats_greedy": bool(rl_val >= greedy_val),
               "ppo_contingency_triggered": bool(ppo_triggered),
               "n_train_episodes": len(train_eps), "n_val_episodes": len(val_eps),
               "device": accel.label}, cfg.cache_dir / "rl_stats.json")

    banner("STAGE 5 COMPLETE")
    print(f"  greedy val reward = {greedy_val:.4f}")
    print(f"  RL     val reward = {rl_val:.4f}  ({'>=' if rl_val>=greedy_val else '<'} greedy)")
    print(f"  PPO contingency triggered: {ppo_triggered} (REINFORCE sufficient if False)")


if __name__ == "__main__":
    main()
