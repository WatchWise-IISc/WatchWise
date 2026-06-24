# CLAUDE.md

This file gives Claude Code the implementation context that is easy to forget while editing this repository. Keep it short and durable. Use `AGENTS.md` for general repo conventions, `README.md` for user-facing setup, `WATCHWISE_MASTER_SPEC.md` for the scientific contract, and `REPORT.md` for final write-up/results.

## What Matters

WatchWise is a fairness-aware group movie recommender backed by real MovieLens ratings. The core comparison is controlled: nearest-neighbour retrieval versus conditional diffusion candidate generation, with the same fairness-aware reranking stack used where relevant. Do not move result claims, metric tables, or thesis narrative into this file; keep those in the report/spec.

The pipeline is the source of truth for app behavior. The React/FastAPI app is a thin demo over cached artifacts and should not reimplement recommendation, filtering, reward, or evaluation logic in frontend code.

## Commands

```bash
pip install -r requirements.txt

# Pipeline
python scripts/run_all.py --accelerator auto
python scripts/run_all.py --phase phase1 --accelerator auto
python scripts/01_prepare_data.py [--phase phase1|phase2] [--accelerator auto] [--no-text-encoder]
python scripts/02_train_mf.py [--phase phase1|phase2] [--accelerator auto]
python scripts/03_train_diffusion.py [--phase phase1|phase2] [--accelerator auto]
python scripts/04_form_groups.py [--phase phase1|phase2]
python scripts/05_train_rl.py [--phase phase1|phase2] [--accelerator auto]
python scripts/06_evaluate.py [--phase phase1|phase2] [--accelerator auto]
python scripts/07_phase_compare.py

# Tests
python -m pytest tests/ -q
python tests/test_smoke.py

# App
./scripts/fetch_cache.sh
./app/start.sh
cd app/frontend && npm install && npm run build
uvicorn app.api.main:app --host 0.0.0.0 --port 18790 --reload
```

There is no lint runner. Smoke tests assume `WATCHWISE_PHASE=phase2` by default and require cached artifacts/results. Use `WATCHWISE_PHASE=phase1` only when intentionally validating the small development phase.

## Pipeline Boundaries

All shared tunables and derived paths live in `watchwise/config.py`. Stage scripts must use `_bootstrap.parse_args()` and write outputs under `data/cache/<dataset>/`; evaluation writes to `results/<phase>/`.

The inference path is:

```text
MovieLens + enrichment
-> MF user/movie embeddings
-> group taste vector
-> candidates: nearest-neighbour or diffusion
-> optional hard filters for Mode 2
-> reranker: greedy fairness selector or REINFORCE policy
-> final slate
```

Evaluation methods are `avg_baseline`, `nn_greedy`, `diffusion_greedy`, `nn_rl`, and `diffusion_rl` (`watchwise/pipeline.py::METHODS`). The app may also use `hybrid_rl` and `hybrid_profile_rl` for demo/cold-start flows; do not treat those as measured scientific ablations unless the evaluation code is explicitly extended.

## App Boundaries

`app/api/engine.py::DemoEngine` is the app behavior layer. It loads `mf.npz`, `text_embeddings.npy`, `catalog.parquet`, `train_ratings.parquet`, `diffusion.pt`, `rl_policy.pt`, and `groups.json` once, builds one `Recommender`, and returns JSON-able dicts for the React app.

`app/api/main.py` should stay endpoint plumbing: startup builds `DemoEngine` from `WATCHWISE_PHASE` (default `phase2`), CORS is limited to the configured local frontend port, and endpoints delegate to engine methods. The frontend calls bare `/api/...`; Vite proxies to the backend port through `app/frontend/vite.config.js`.

`./app/start.sh` is phase2-only, fetches the phase2 cache first, installs frontend dependencies if needed, and starts FastAPI on `WATCHWISE_BACKEND_PORT` default `18790` plus Vite on `WATCHWISE_FRONTEND_PORT` default `18791`.

`swiss-grid-ui/` is a standalone visual prototype with hardcoded data, not the production React app. Treat it as design reference only unless explicitly porting pieces into `app/frontend/src/`.

## Invariants

- Non-circular evaluation: `splits.make_user_holdout` hides per-user ratings before MF training; held-out ratings become the ground truth for NDCG/Hit.
- Controlled ablations: NN versus diffusion must share reranker and filters; greedy versus RL must share candidate pool and filters.
- Group discipline: RL trains and evaluates on disjoint group splits from `groups._assign_splits`.
- Reward semantics: relevance is mean satisfaction over members and slate; fairness is the worst member's best slate option. Do not make the `w2` term redundant with relevance.
- Satisfaction signal: reranking and app "Best for" use `CatalogSpace.member_satisfaction`, a within-member percentile taste-fit proxy, not raw MF rating.
- Mode 2 filters are constraints. OTT/runtime/age checks happen before scoring and only when provider constraints are active.
- Mode 3 and custom groups are illustrative cold-start flows. They map declared profiles to proxy MovieLens users and have no held-out NDCG/Hit.
- Families/groups are synthetic groupings of real MovieLens users; never imply real co-viewing data.

## Implementation Guardrails

Use `watchwise/accelerator.py::Accelerator` for device movement and optimizer steps. Do not hard-code `.cuda()`, `.to("mps")`, or direct `torch_xla` calls in model/training code.

Keep candidate generation and reranking interfaces aligned through `Recommender.recommend`. If adding a method, update labels, evaluation paths, app payloads, and tests together.

Do not add raw latent vectors back into `models/rl._build_features`; the policy is intentionally driven by the small set of group-relative fairness scalars.

`data/text_encoder.py` must keep the deterministic TF-IDF+SVD fallback. The pipeline should complete when the sentence-transformer model or network access is unavailable.

Cache artifacts are fetched or regenerated, not committed. `scripts/fetch_cache.sh` supports phase2 only. `scripts/deploy_gcp_vm.sh` is a clean VM redeploy path that syncs runtime files and the local phase2 cache; read the script before changing deployment behavior rather than duplicating its details here.

Secrets stay out of git. `.env`, `TMDB_API_KEY`, and `TMDB_READ_ACCESS_TOKEN` are optional for enrichment; without them, runtime/certification/OTT fields use deterministic offline fallbacks while MovieLens genres/year/popularity remain real.
