# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WatchWise 2.0 is a **fairness-aware group movie recommender** built as a Deep Learning course
project. The scientific claim is a comparison, not a product: does a **conditional diffusion**
candidate generator produce better *group-compromise* recommendations than **traditional
nearest-neighbour retrieval**, when both feed an *identical* fairness-aware reranker? Everything is
grounded in real MovieLens ratings and evaluated against held-out ratings so the comparison is
measured, not asserted.

`WATCHWISE_MASTER_SPEC.md` is the **canonical specification** (when code and spec disagree, the spec
wins unless a newer decision is recorded there). `README.md` is the runnable overview; `REPORT.md` is
the academic write-up with the final numbers.

## Commands

All stage scripts read one config block (`watchwise/config.py`) and accept `--phase` and
`--accelerator`. Each stage caches its output under `data/cache/<dataset>/`; results land in
`results/<phase>/`.

```bash
pip install -r requirements.txt

# Full pipeline — download → MF → diffusion → groups → RL → evaluation
python scripts/run_all.py --accelerator auto        # local: mps/cuda/cpu auto-detected
python scripts/run_all.py --accelerator cpu         # Kaggle "None"
python scripts/run_all.py --accelerator cuda        # Kaggle "GPU P100" (single CUDA)
python scripts/run_all.py --accelerator cuda_multi  # Kaggle "GPU T4 x2" (DataParallel)
python scripts/run_all.py --accelerator tpu         # Kaggle "TPU v5e-8" (torch_xla)
python scripts/run_all.py --phase phase2 --accelerator cuda   # scale: ml-25m, same code

# Individual stages (this order; each depends on the previous one's cache)
python scripts/01_prepare_data.py [--no-text-encoder]   # MovieLens + enrichment + text embeddings
python scripts/02_train_mf.py            # MF embeddings + the per-user holdout split
python scripts/03_train_diffusion.py     # conditional DDPM candidate generator
python scripts/04_form_groups.py         # random/similar/divergent groups + held-out ground truth
python scripts/05_train_rl.py            # REINFORCE slate-builder (disjoint group splits)
python scripts/06_evaluate.py            # 4-way comparison + w2 sweep + figures → results/<phase>/
python scripts/07_phase_compare.py       # optional: Phase 1 vs Phase 2 once both have run

# Tests (run after the pipeline has produced cached artifacts)
python tests/test_smoke.py               # or: python -m pytest tests/ -q   (6 invariant tests)

# App — React + FastAPI (the primary UI; offline, reads cached artifacts only)
./app/start.sh                           # FastAPI :8000 + Vite dev :5173; phase2 by default
./app/start.sh --phase phase1            # small dataset
./scripts/fetch_cache.sh phase2          # pull the ~416 MB phase2 cache from the GitHub Release
uvicorn app.api.main:app --reload        # backend only (frontend dev: cd app/frontend && npm run dev)

# Demo (legacy — same 3 modes, Gradio; offline)
python app/demo.py                       # Gradio, http://localhost:7860
```

There is no separate lint runner. Correctness is enforced by `tests/test_smoke.py` (asserts the
non-circular and ablation invariants below) and by each stage's cached artifacts loading downstream.

## Accelerator model (Kaggle-portable)

The project runs unchanged across Kaggle's accelerator menu (**None / GPU T4 ×2 / GPU P100 /
TPU v5e-8**) and local Apple Silicon. Device handling is centralized in `watchwise/accelerator.py`
(`Accelerator`). **Never hard-code `.cuda()` / `.to("mps")` / torch_xla in model or training code** —
always go through the accelerator: `accel.wrap(model)` (to-device + DataParallel for T4×2),
`accel.to_device(batch)`, `accel.step(optimizer)` (xm.optimizer_step on TPU), `accel.mark_step()`.
Modes (`--accelerator`): `auto`, `cpu`/`none`, `mps`, `cuda`/`p100`, `cuda_multi`/`t4x2`, `tpu`.
TPU uses a single XLA core by design (models are tiny); torch_xla is imported lazily so non-TPU
environments never need it.

## Architecture (the pipeline IS the product)

Inference for one group flows strictly in this order (`watchwise/pipeline.py::Recommender.recommend`):

```
MovieLens ratings + links.csv
  → enriched catalog (TMDb if TMDB_API_KEY else offline fallback)      data/enrich.py
  → MF member/movie embeddings (train split only)                      models/mf.py
  → group formation → group taste vector                               groups.py, candidates.py
  → candidate generation:  [NN retrieval]  XOR  [diffusion]  ← the swap candidates.py, models/diffusion.py
  → hard filters (OTT/language/runtime/age), Mode 2 only, BEFORE scoring  filters.py
  → reranking:  [greedy fairness bandit]  XOR  [REINFORCE slate]       models/reranker.py, models/rl.py
  → final 3-5 movie watchlist                                          pipeline.py
```

`pipeline.METHODS` are the five ablations: `avg_baseline`, `nn_greedy`, `diffusion_greedy`,
`nn_rl`, `diffusion_rl`. Comparing generators (`nn_*` vs `diffusion_*`) holds the reranker fixed;
comparing rerankers (`*_greedy` vs `*_rl`) holds the pool fixed.

## The app (React + FastAPI — thin layer over the pipeline)

The UI never re-implements recommendation logic; it loads the cached artifacts once and calls
`Recommender.recommend`. Two halves talk over HTTP; Vite proxies `/api` → `:8000` (`vite.config.js`),
so frontend code calls bare `/api/...` (`app/frontend/src/api.js`) and CORS is open only to localhost.

- **`app/api/engine.py::DemoEngine`** is the single source of app behaviour. Its `__init__` loads every
  cached artifact (`mf.npz`, `text_embeddings.npy`, `catalog.parquet`, `train_ratings.parquet`,
  `diffusion.pt`, `rl_policy.pt`, `groups.json`) for one phase and builds one `Recommender`. Methods
  return **plain JSON-able dicts** (not DataFrames/Markdown) — `run_mode1_api` / `run_mode2_api` /
  `run_mode3_api` mirror the three demo modes. **`app/demo.py` (Gradio) is the legacy twin of the same
  engine logic** — keep the two in sync when changing demo behaviour.
- **`app/api/main.py`** is just endpoint plumbing: a `lifespan` hook builds the `DemoEngine` at startup
  from `WATCHWISE_PHASE` (default `phase2`; note `DemoEngine`'s own default is `phase1`), then routes
  `/api/groups`, `/api/group/{gid}/members`, `/api/mode{1,2,3}/...`, `/api/results/summary`.
- **`"Best for" uses taste-fit, not raw rating** (`_slate_data` → `member_satisfaction`) — same reason
  as the pipeline gotcha below; raw MF rating would credit whoever likes the broadly-popular pick.
- **Cache is fetched, not committed.** `data/cache/` is gitignored (binaries too large for git), so
  `start.sh` runs `scripts/fetch_cache.sh`, which downloads `ml-25m-cache.tar.gz` from the GitHub
  Release `phase2-cache` (repo `WATCHWISE_REPO`, default `kvamsi-iisc/WatchWise`) on first run. Only
  phase2 is published; phase1 regenerates via the pipeline. App startup fails without this cache.

## Invariants that protect the result (do not break these)

- **Non-circular evaluation.** `splits.make_user_holdout` hides 20% of each user's ratings *before*
  MF training, so MF never sees the held-out set; group ground truth = those held-out movies. Held-out
  NDCG@5/Hit@5 (in `evaluate.py`) are the non-circular validation.
- **Ablation fairness.** NN vs diffusion → identical reranker + filters; bandit vs RL → identical pool
  + filters. Only one component changes at a time.
- **RL data discipline.** The policy trains/evaluates on **disjoint groups** (`groups._assign_splits`,
  70/15/15), not just held-out ratings.
- **The `min`-over-members reward term + the `w2` sweep** are the headline fairness artifacts — keep
  them. The demo and report depend on the divergent-group comparison.
- **Offline demo / training.** No external API calls; all enrichment is pre-fetched/cached.

## Implementation gotchas (hard-won — read before changing these)

- **Taste-fit satisfaction is load-bearing** (`CatalogSpace.member_satisfaction`). Raw MovieLens MF
  ratings are popularity-dominated, so members barely disagree → the fairness `min` term and the w2
  sweep go dead-flat. Satisfaction is therefore each member's *percentile rank of the predicted rating
  within their own catalog-wide distribution*. Held-out NDCG/Hit stay on raw ratings (non-circular).
- **Reward semantics** (`reward.py`): relevance = mean satisfaction over members & slate; fairness =
  `min_member(max_over_slate)`. Using max-over-slate for *both* makes `w2` redundant with relevance —
  don't.
- **Divergent groups are engineered** (`groups._farthest_clusters` + extreme members), else member
  rank-correlation stays ~0.67 and nothing diverges; with the fix it's ~0.45 and the baseline visibly
  strands the worst-off member.
- **RL features must be the ~8 group-relative fairness scalars only** (`models/rl._build_features`).
  Including the raw 64-d latent blocks (192 dims) swamps the signal and the policy never learns
  fairness. The greedy bandit is near-optimal here; REINFORCE reaching ~97% of it (PPO contingency
  flag firing) is an expected, reported outcome.
- **Text encoder fallback:** `all-mpnet-base-v2` can stall on Apple MPS/CPU (HF load hang), so
  `data/text_encoder.py` wraps it in a SIGALRM timeout and falls back to deterministic TF-IDF+SVD.
  The pipeline always completes; mpnet activates where downloads are reliable (Kaggle/Colab).

## Honesty commitments (carry into code comments, demo labels, and the report)

- Families are **synthetic** (real users grouped); "group satisfaction" is a predicted-rating proxy on
  real held-out movies — never real co-viewing. Mode 3 (cold-start) is **illustrative, not measured**.
- Without `TMDB_API_KEY`, OTT/language/certification are a deterministic offline fallback (labelled
  `enrichment_source`); genres, year and popularity are real MovieLens data.
