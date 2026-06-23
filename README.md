# WatchWise 2.0 — Fairness-Aware Group Movie Recommender

> **Deep Learning course project.** Does a **conditional diffusion** candidate
> generator produce better *group-compromise* movie recommendations than
> **traditional nearest-neighbour retrieval**, when both feed an *identical*
> fairness-aware reranker? Grounded in real MovieLens ratings and evaluated against
> held-out ratings, so the answer is **measured, not asserted.**

Netflix-style recommenders optimise for **one** profile. A family watching together
is a **group decision**: different tastes, plus real constraints (what's streamable
tonight, runtime, age). WatchWise treats movie selection as a
*fairness-aware group compromise* — maximise total satisfaction **while protecting
the member who is usually ignored**.

The full design is in [`WATCHWISE_MASTER_SPEC.md`](WATCHWISE_MASTER_SPEC.md);
guidance for working in the repo is in [`CLAUDE.md`](CLAUDE.md).

---

## What it does (the experiment)

Five approaches are compared on the **same** held-out groups (spec §10.4):

| # | Approach | Candidate generation | Reranker |
| --- | --- | --- | --- |
| 1 | Average baseline | — (top-K by mean rating) | none |
| 2 | NN + bandit | traditional nearest-neighbour | greedy fairness selector |
| 3 | **Diffusion + bandit** | **conditional diffusion** | greedy fairness selector |
| 4 | NN + RL | traditional nearest-neighbour | REINFORCE slate-builder |
| 5 | **Diffusion + RL** (headline) | **conditional diffusion** | REINFORCE slate-builder |

* **2 vs 3** isolates *candidate generation* (NN vs diffusion) — same reranker, same filters.
* **3 vs 5** isolates the *reranker* (bandit vs RL) — same pool, same filters.
* The **w2 sweep** traces the fairness-vs-relevance trade-off (a result in itself).

Headline metric: **min-member satisfaction** (the worst-off family member), reported
next to mean relevance and the **non-circular** held-out **NDCG@5 / Hit@5**.

---

## Quickstart

```bash
pip install -r requirements.txt

# Full pipeline: download -> MF -> diffusion -> groups -> RL -> evaluation
python scripts/run_all.py --accelerator auto
```

Stages can also be run one at a time (`scripts/01_prepare_data.py` … `06_evaluate.py`);
each caches its output under `data/cache/<dataset>/`, and results land in `results/`.

### Run the app (React + FastAPI)

```bash
pip install -r requirements.txt
./app/start.sh                       # phase2 by default; --phase phase1 for the small dataset
# Frontend: http://localhost:18791   Backend: http://localhost:18790/docs
# (start.sh always uses these custom ports to avoid clashing with default Vite:5173 / uvicorn:8000)
```

`start.sh` installs the frontend deps (`npm install`) and, on first run, **downloads the
phase2 model-artifact cache (~416 MB) from the GitHub Release** into `data/cache/ml-25m/`
(the binaries are too large for plain git, so `data/cache/` is gitignored). The download
needs the Release `phase2-cache` to exist with asset `ml-25m-cache.tar.gz`; otherwise
regenerate the cache with `python scripts/run_all.py --phase phase2`. You can also fetch
the cache on its own with `./scripts/fetch_cache.sh phase2`.

## Runs anywhere — pick your accelerator

Device handling is centralised in `watchwise/accelerator.py`; the mode is a single
flag, so the identical code runs across Kaggle's accelerator menu and local Apple
Silicon:

| Environment | Flag |
| --- | --- |
| Kaggle **None** / any CPU | `--accelerator cpu` |
| Kaggle **GPU P100** (single CUDA) | `--accelerator cuda` |
| Kaggle **GPU T4 ×2** (multi-GPU) | `--accelerator cuda_multi` |
| Kaggle **TPU v5e-8** (torch_xla) | `--accelerator tpu` |
| Local Apple Silicon (M-series) | `--accelerator mps` |
| Detect automatically | `--accelerator auto` |

On Kaggle, open [`notebooks/watchwise_kaggle.ipynb`](notebooks/watchwise_kaggle.ipynb),
set `ACCELERATOR` to match the runtime, and run all cells.

## Two phases (same code, just bigger)

| Phase | Dataset | Use | Flag |
| --- | --- | --- | --- |
| Phase 1 | `ml-latest-small` (100K ratings) | fast dev + demo | `--phase phase1` (default) |
| Phase 2 | `ml-25m` (25M ratings) | scale / final numbers | `--phase phase2` |

## The app (React + FastAPI, 3 modes)

* **Mode 1 — Core science (measured):** baseline vs WatchWise on a divergent group;
  shows diffusion candidates and the worst-off-member lift.
* **Mode 2 — OTT + age (filtered):** users select one or more streaming services;
  every pick is streamable on the selected subscriptions and stays within runtime
  and age-safety limits.
* **Mode 3 — Cold-start family (illustrative, NOT measured):** a hand-authored
  family, clearly labelled.

## Honesty notes

* Families are **synthetic** (real MovieLens users grouped); "group satisfaction" is
  a predicted-rating proxy on **real held-out** ratings — never real co-viewing
  (spec §18.2). The held-out NDCG/Hit metrics keep the evaluation non-circular.
* With no `TMDB_API_KEY`, the OTT/runtime/age fields are a **deterministic offline
  fallback** (clearly labelled); genres, year and popularity are real MovieLens data.
  Set `TMDB_API_KEY` to fetch and cache real TMDb metadata instead.
* The text encoder is a frozen `all-mpnet-base-v2`; if it (or its download) is
  unavailable, a deterministic TF-IDF+SVD fallback is used so the pipeline always
  completes (e.g. Kaggle with internet off).

## Layout

```
watchwise/        config, accelerator, data/, models/ (mf, diffusion, reranker, rl),
                  candidates, reward, groups, filters, pipeline, evaluate, coldstart
scripts/          01_prepare_data … 06_evaluate, run_all, deploy_gcp_vm.sh
app/api/          FastAPI backend for the React app
app/frontend/     React UI
notebooks/        Kaggle notebook (all accelerators)
results/          metrics CSV/JSON, figures, summary.md  (generated)
```
