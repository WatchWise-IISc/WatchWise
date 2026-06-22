"""Single source of truth for every tunable in WatchWise 2.0.

A phase switch (``phase1`` / ``phase2``) or an accelerator switch is a one-line
change here; nothing else in the codebase hard-codes a size, a path, a seed, or
a device. See ``WATCHWISE_MASTER_SPEC.md`` §12 for the rationale behind each
value (which are *Fixed* by design vs. *Tuned* on a validation grid).
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Repository root = parent of the ``watchwise`` package directory.
ROOT = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------------------- #
# Region configuration (Mode 2 hard filters) — geography-parameterised.       #
# India is the primary demo instance; US ships as the "agnostic design" proof.#
# --------------------------------------------------------------------------- #
@dataclass
class RegionConfig:
    """Hard-filter configuration for one geography (spec §15.1)."""

    name: str
    watch_region: str                 # ISO 3166-1 country code (TMDb watch/providers)
    platforms: List[str]              # provider names treated as "available"
    languages: List[str]              # acceptable original_language codes (ISO 639-1)
    max_runtime_min: int              # runtime cap for "tonight"
    family_safe_certs: List[str]      # youngest-safe allowlist (per national rating system)
    teen_certs: List[str]             # older-teen tier added only when allow_teen=True
    rating_system: str                # CBFC / MPAA / ...


REGIONS: Dict[str, RegionConfig] = {
    "IN": RegionConfig(
        name="India",
        watch_region="IN",
        platforms=["Netflix", "Disney+ Hotstar", "Amazon Prime Video", "Zee5", "SonyLIV"],
        languages=["hi", "ta", "en"],
        max_runtime_min=150,
        # CBFC: U = all ages, UA = parental guidance (older-teen), A/S = adult (excluded).
        # UA is the *teen* tier, so allow_teen=False (young child) tightens to U-only.
        family_safe_certs=["U"],
        teen_certs=["UA", "U/A"],
        rating_system="CBFC",
    ),
    "US": RegionConfig(
        name="United States",
        watch_region="US",
        platforms=["Netflix", "Disney+", "Hulu", "Amazon Prime Video", "Max"],
        languages=["en"],
        max_runtime_min=150,
        # MPAA: G/PG youngest-safe, PG-13 the togglable teen tier; R/NC-17 excluded.
        family_safe_certs=["G", "PG"],
        teen_certs=["PG-13"],
        rating_system="MPAA",
    ),
}


@dataclass
class WatchWiseConfig:
    """All hyperparameters and paths in one place."""

    # --- phase / data ------------------------------------------------------ #
    phase: str = "phase1"
    dataset: str = "ml-latest-small"     # phase2 -> "ml-25m" or "ml-32m"
    dataset_url: str = (
        "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
    )

    # --- compute ----------------------------------------------------------- #
    # One of: auto | cpu/none | mps | cuda/p100 | cuda_multi/t4x2 | tpu
    accelerator: str = "auto"
    tpu_cores: int = 1
    seed: int = 42

    # --- matrix factorization (spec §12.1) --------------------------------- #
    mf_latent_dim: int = 64
    mf_lr: float = 5e-3
    mf_weight_decay: float = 1e-4
    mf_epochs: int = 40
    mf_batch_size: int = 1024

    # --- text / content features (spec §16, D6) ---------------------------- #
    # Frozen sentence encoder; falls back to TF-IDF+SVD if unavailable.
    text_encoder: str = "sentence-transformers/all-mpnet-base-v2"
    text_embed_dim: int = 768            # mpnet native dim; fallback SVD matches this
    use_text_encoder: bool = True        # set False to force the deterministic fallback
    text_encoder_timeout_s: int = 240    # hang guard: fall back if encoding stalls

    # --- diffusion candidate generator (spec §12.2) ----------------------- #
    diff_num_timesteps: int = 200        # T
    diff_beta_schedule: str = "cosine"
    diff_beta_start: float = 1e-4
    diff_beta_end: float = 0.02
    diff_hidden_dim: int = 256
    diff_num_layers: int = 3
    diff_time_embed_dim: int = 64
    diff_lr: float = 1e-3
    diff_epochs: int = 300
    diff_batch_size: int = 256
    diff_sampling_steps: int = 50        # DDIM steps at inference (< T)
    diff_num_candidates: int = 100       # candidate vectors sampled per group
    diff_guidance: float = 1.5           # classifier-free guidance scale at sampling

    # --- group formation (spec §12.3) -------------------------------------- #
    group_size_min: int = 2
    group_size_max: int = 5
    num_groups: int = 600                # split 3 ways -> ~200 per kind (test ~30/kind)
    num_taste_clusters: int = 8
    holdout_frac: float = 0.2
    group_split: Tuple[float, float, float] = (0.70, 0.15, 0.15)
    min_ratings_per_user: int = 20       # users below this are excluded from grouping

    # --- reward weights (spec §10.1 / §12.4) — the most important knobs ---- #
    w1_sum: float = 1.0                  # total group relevance (reference weight)
    w2_min: float = 1.0                  # worst-off member — the fairness differentiator
    w3_diversity: float = 0.2            # intra-list dissimilarity
    w4_disagreement: float = 0.2         # penalty on spread across members
    slate_size: int = 5                  # K — final watchlist length
    # The w2 sweep is itself a result (the fairness-vs-relevance trade-off curve):
    w2_sweep: Tuple[float, ...] = (0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0)

    # --- candidate pool ---------------------------------------------------- #
    candidate_pool_size: int = 80        # filtered pool fed to the reranker
    nn_pool_multiplier: int = 4          # NN retrieves K*size members then unions

    # --- RL slate-builder (spec §12.4 / §10.3) ----------------------------- #
    rl_lr: float = 3e-4
    rl_gamma: float = 0.99
    rl_entropy_coef: float = 0.01
    rl_episodes: int = 4000
    rl_hidden_dim: int = 128
    rl_reward_shaping: str = "dense"     # "dense" | "terminal"

    # --- evaluation (spec §12.5) ------------------------------------------- #
    top_k: int = 5
    relevant_threshold: float = 4.0      # a held-out movie is "relevant" if rating >= this

    # --- demo -------------------------------------------------------------- #
    default_region: str = "IN"
    enrichment_snapshot_date: str = "2026-06-13"

    # --- paths (derived) --------------------------------------------------- #
    data_dir: Path = field(default_factory=lambda: ROOT / "data")
    results_root: Path = field(default_factory=lambda: ROOT / "results")

    # ------------------------------------------------------------------ #
    @property
    def results_dir(self) -> Path:
        # Namespaced per phase so a Phase-1 vs Phase-2 comparison is possible.
        return self.results_root / self.phase

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def dataset_dir(self) -> Path:
        return self.raw_dir / self.dataset

    @property
    def cache_dir(self) -> Path:
        # Caches are namespaced per-dataset so phase 1 and phase 2 never collide.
        return self.data_dir / "cache" / self.dataset

    def ensure_dirs(self) -> None:
        for d in (self.raw_dir, self.cache_dir, self.results_dir):
            d.mkdir(parents=True, exist_ok=True)

    def region(self, code: Optional[str] = None) -> RegionConfig:
        return REGIONS[code or self.default_region]

    # ------------------------------------------------------------------ #
    def reward_weights(self) -> Dict[str, float]:
        return {"w1": self.w1_sum, "w2": self.w2_min,
                "w3": self.w3_diversity, "w4": self.w4_disagreement}

    def summary(self) -> str:
        return (f"WatchWise[{self.phase}] dataset={self.dataset} "
                f"accel={self.accelerator} seed={self.seed} "
                f"k_mf={self.mf_latent_dim} T={self.diff_num_timesteps} "
                f"w2={self.w2_min} K={self.slate_size}")

    def save(self, path: Path) -> None:
        d = asdict(self)
        d["data_dir"] = str(self.data_dir)
        d["results_root"] = str(self.results_root)
        d["results_dir"] = str(self.results_dir)
        d["cache_dir"] = str(self.cache_dir)
        d["group_split"] = list(self.group_split)
        d["w2_sweep"] = list(self.w2_sweep)
        path.write_text(json.dumps(d, indent=2))


def phase1_config(**overrides) -> WatchWiseConfig:
    """Fast development preset (Mac MPS / Kaggle): ml-latest-small."""
    cfg = WatchWiseConfig(phase="phase1", dataset="ml-latest-small")
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return cfg


def phase2_config(**overrides) -> WatchWiseConfig:
    """Scale preset (borrowed GPU / Kaggle): ml-25m, larger models (spec §13.3)."""
    cfg = WatchWiseConfig(
        phase="phase2",
        dataset="ml-25m",
        dataset_url="https://files.grouplens.org/datasets/movielens/ml-25m.zip",
        mf_latent_dim=128, mf_lr=1e-3, mf_weight_decay=1e-5,
        mf_epochs=12, mf_batch_size=8192,
        diff_num_timesteps=500, diff_hidden_dim=512, diff_num_layers=4,
        diff_time_embed_dim=128, diff_lr=3e-4, diff_epochs=120,
        diff_batch_size=2048, diff_sampling_steps=100, diff_num_candidates=300,
        num_groups=2000, rl_episodes=20000, candidate_pool_size=120,
    )
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return cfg


def get_config(phase: str = "phase1", **overrides) -> WatchWiseConfig:
    cfg = phase2_config(**overrides) if phase == "phase2" else phase1_config(**overrides)
    cfg.ensure_dirs()
    return cfg
