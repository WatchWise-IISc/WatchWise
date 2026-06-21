"""REINFORCE slate-builder — the headline RL reranker (spec §10.3, decision D11).

A policy builds the watchlist **sequentially**: at each step it scores every pool
candidate from the *current* partial slate and samples the next pick; at episode
end it receives the fairness-aware reward. This can beat the greedy bandit because
the reward has **slate-level, non-additive terms** (``min``, diversity, variance):
the best slate is not always the top-K individual items, and a sequential policy
optimising the terminal reward can find those combinations.

Committed method: **REINFORCE with a value baseline** + dense per-step shaping
(marginal reward) + an entropy bonus. PPO is a documented contingency, not built
unless REINFORCE fails the validation-stability check. The policy is feature-based
(candidate features are group-relative), so a single policy generalises across the
disjoint train/val/test **groups** (spec §10.3 data discipline).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

import numpy as np
import torch
import torch.nn as nn
from torch.distributions import Categorical

from ..accelerator import Accelerator
from ..config import WatchWiseConfig
from ..reward import RewardModel


@dataclass
class GroupEpisode:
    """Everything the policy needs to roll out one group (precomputed once)."""

    sat: np.ndarray            # [n_members, n_pool] satisfaction in [0, 1]
    sim: np.ndarray            # [n_pool, n_pool] similarity (diversity)
    zpool: np.ndarray          # [n_pool, k] standardised movie latents
    group_emb: np.ndarray      # [k] standardised group centroid
    rm: RewardModel            # shared objective definition

    @property
    def n_pool(self) -> int:
        return self.sat.shape[1]


def make_episode(rm: RewardModel, zpool: np.ndarray, group_emb: np.ndarray) -> GroupEpisode:
    return GroupEpisode(sat=rm.sat, sim=rm.sim, zpool=zpool.astype(np.float32),
                        group_emb=group_emb.astype(np.float32), rm=rm)


# Per-candidate features are *group-relative scalars* (all in ~[0, 1]) describing
# how adding the candidate changes the fairness objective. We deliberately do NOT
# include the raw latent vectors: 192 standardised latent dims would swamp the few
# scalars that actually drive the fairness reward, and the policy would never learn
# to protect the worst-off member. These scalars are exactly the quantities the
# reward depends on, so a policy over them can match — and, via slate-level
# lookahead, potentially beat — the greedy selector.
_FEAT_DIM = 8
_STATE_DIM = 3


class SlatePolicy(nn.Module):
    """Pointer-style policy + value head over a variable-size candidate pool."""

    def __init__(self, latent_dim: int, hidden_dim: int):
        super().__init__()
        self.latent_dim = latent_dim          # kept for checkpoint compatibility
        self.policy = nn.Sequential(
            nn.Linear(_FEAT_DIM, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, 1),
        )
        self.value = nn.Sequential(
            nn.Linear(_STATE_DIM, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, 1),
        )

    def logits(self, feats: torch.Tensor) -> torch.Tensor:
        return self.policy(feats).squeeze(-1)

    def state_value(self, state: torch.Tensor) -> torch.Tensor:
        return self.value(state).squeeze(-1)


def _build_features(ep: GroupEpisode, selected: List[int],
                    member_sat: np.ndarray, slate_len: int) -> np.ndarray:
    """Group-relative feature matrix for every pool candidate at this step."""
    P = ep.n_pool
    cur_min = float(member_sat.min()) if len(selected) else 0.0
    cur_mean = float(member_sat.mean()) if len(selected) else 0.0
    worst = int(member_sat.argmin()) if len(selected) else 0
    progress = len(selected) / max(1, slate_len)

    # If this candidate were added: new per-member sat = max(current, sat[:, c]).
    new_sat = np.maximum(member_sat[:, None], ep.sat)          # [M, P]
    cand_min = new_sat.min(0)                                  # worst-off after adding
    cand_mean = new_sat.mean(0)                                # overall after adding
    cand_help_worst = ep.sat[worst]                            # helps the current worst?
    fairness_gain = cand_min - cur_min                         # marginal fairness
    if selected:
        max_sim_to_slate = ep.sim[:, selected].max(1)
    else:
        max_sim_to_slate = np.zeros(P, dtype=np.float32)
    cand_div_gain = 1.0 - max_sim_to_slate

    return np.stack([cand_min, cand_mean, cand_help_worst, fairness_gain, cand_div_gain,
                     np.full(P, progress, np.float32),
                     np.full(P, cur_min, np.float32),
                     np.full(P, cur_mean, np.float32)], axis=1).astype(np.float32)  # [P, 8]


def rollout(policy: SlatePolicy, ep: GroupEpisode, k: int, accel: Accelerator,
            sample: bool = True):
    """One episode. Returns (slate, log_probs, entropies, values, step_rewards)."""
    dev = accel.device
    selected: List[int] = []
    member_sat = np.zeros(ep.sat.shape[0], dtype=np.float32)
    log_probs, entropies, values, step_rewards = [], [], [], []
    prev_reward = 0.0
    k = min(k, ep.n_pool)

    for _ in range(k):
        feats = torch.as_tensor(_build_features(ep, selected, member_sat, k), device=dev)
        logits = policy.logits(feats)
        if selected:
            mask = torch.zeros(ep.n_pool, device=dev)
            mask[selected] = -1e9
            logits = logits + mask
        dist = Categorical(logits=logits)
        action = dist.sample() if sample else torch.argmax(logits)

        state = torch.as_tensor(
            np.array([len(selected) / max(1, k),
                      float(member_sat.min()) if len(selected) else 0.0,
                      float(member_sat.mean()) if len(selected) else 0.0],
                     dtype=np.float32), device=dev)

        log_probs.append(dist.log_prob(action))
        entropies.append(dist.entropy())
        values.append(policy.state_value(state))

        a = int(action.item())
        selected.append(a)
        member_sat = np.maximum(member_sat, ep.sat[:, a])
        r = ep.rm.reward(selected)
        step_rewards.append(r - prev_reward)        # dense shaping = marginal reward
        prev_reward = r

    return selected, log_probs, entropies, values, step_rewards


def train_rl(train_eps: Sequence[GroupEpisode], cfg: WatchWiseConfig,
             accel: Accelerator, latent_dim: int,
             val_eps: Optional[Sequence[GroupEpisode]] = None) -> SlatePolicy:
    """Train the policy over disjoint training groups; report val reward."""
    policy = accel.wrap(SlatePolicy(latent_dim, cfg.rl_hidden_dim))
    opt = torch.optim.Adam(policy.parameters(), lr=cfg.rl_lr)
    rng = np.random.default_rng(cfg.seed)

    batch = 32
    n_updates = max(1, cfg.rl_episodes // batch)
    use_dense = (cfg.rl_reward_shaping == "dense")

    for update in range(n_updates):
        opt.zero_grad()
        policy_loss = torch.zeros((), device=accel.device)
        value_loss = torch.zeros((), device=accel.device)
        entropy_term = torch.zeros((), device=accel.device)
        batch_reward = 0.0

        for _ in range(batch):
            ep = train_eps[int(rng.integers(len(train_eps)))]
            slate, logps, ents, vals, step_r = rollout(
                policy, ep, cfg.slate_size, accel, sample=True)

            # Discounted returns from (dense or terminal) step rewards.
            if not use_dense:
                step_r = [0.0] * (len(step_r) - 1) + [ep.rm.reward(slate)]
            returns, g = [], 0.0
            for r in reversed(step_r):
                g = r + cfg.rl_gamma * g
                returns.insert(0, g)
            returns_t = torch.as_tensor(returns, dtype=torch.float32, device=accel.device)
            vals_t = torch.stack(vals)
            adv = returns_t - vals_t.detach()

            policy_loss = policy_loss - (torch.stack(logps) * adv).sum()
            value_loss = value_loss + ((returns_t - vals_t) ** 2).sum()
            entropy_term = entropy_term + torch.stack(ents).sum()
            batch_reward += ep.rm.reward(slate)

        loss = (policy_loss + 0.5 * value_loss
                - cfg.rl_entropy_coef * entropy_term) / batch
        loss.backward()
        accel.step(opt)
        accel.mark_step()

        if update % max(1, n_updates // 10) == 0 or update == n_updates - 1:
            msg = f"  [rl] update {update:4d}/{n_updates}  train_reward={batch_reward/batch:.4f}"
            if val_eps:
                msg += f"  val_reward={evaluate_policy(policy, val_eps, cfg, accel):.4f}"
            print(msg)
    return accel.unwrap(policy)


@torch.no_grad()
def evaluate_policy(policy: SlatePolicy, eps: Sequence[GroupEpisode],
                    cfg: WatchWiseConfig, accel: Accelerator) -> float:
    policy.eval()
    total = 0.0
    for ep in eps:
        slate, *_ = rollout(policy, ep, cfg.slate_size, accel, sample=False)
        total += ep.rm.reward(slate)
    policy.train()
    return total / max(1, len(eps))


def rl_select(policy: SlatePolicy, ep: GroupEpisode, cfg: WatchWiseConfig,
              accel: Accelerator) -> List[int]:
    """Greedy (argmax) rollout for inference -> pool indices."""
    with torch.no_grad():
        slate, *_ = rollout(policy, ep, cfg.slate_size, accel, sample=False)
    return slate


def save_policy(policy: SlatePolicy, path, latent_dim: int, cfg: WatchWiseConfig) -> None:
    torch.save({"state_dict": policy.state_dict(), "latent_dim": latent_dim,
                "hidden_dim": cfg.rl_hidden_dim}, path)


def load_policy(path, accel: Accelerator) -> SlatePolicy:
    ckpt = torch.load(path, map_location="cpu")
    policy = SlatePolicy(ckpt["latent_dim"], ckpt["hidden_dim"])
    policy.load_state_dict(ckpt["state_dict"])
    return accel.unwrap(accel.wrap(policy))
