# WatchWise 2.0 — Fairness-Aware Group Movie Recommender

## Project Abstract

WatchWise is a group movie recommendation system designed to help families and friends reach a consensus on what to watch together. Group movie selection is inherently challenging due to diverse individual tastes and practical constraints like streaming availability, runtime, and age suitability. While conventional recommendation systems optimize for individual users or default to majority preferences, WatchWise treats selection as a group decision problem. It aims to generate a concise list of three to five movies that balance collective interests while ensuring fairness for the least satisfied participant.

The system maps users and movies into a shared latent preference space by learning embeddings from real movie rating data. Individual user embeddings are aggregated into a unified group embedding to capture collective preferences. WatchWise then generates candidate movies by combining two complementary approaches: traditional nearest neighbor retrieval and diffusion based generation.

Nearest neighbor retrieval identifies movies closest to the group embedding. Concurrently, WatchWise explores diffusion models as a conditional generative mechanism over movie embeddings. While diffusion based recommendation is an emerging and largely experimental area in recommender system research, its generative nature makes it a promising approach for exploring complex group preference distributions. An ideal group recommendation might not align directly with any single member’s history, but rather exist in a latent zone between multiple users tastes. A diffusion model can find middle ground choices that traditional retrieval methods might overlook.

This project does not assume diffusion is inherently superior to established techniques. Instead, it investigates whether diffusion based generation can discover high quality compromise recommendations that are not identified by traditional retrieval methods, and whether combining both approaches improves group satisfaction and fairness. After candidates are generated, they are filtered by practical constraints and refined through a fairness aware selection process. Finally, the system is evaluated using actual, previously unseen user ratings, enabling an objective comparison of retrieval, diffusion, and hybrid strategies with respect to recommendation quality and group fairness. Ultimately, WatchWise helps a group decide together, rather than personalizing for one person at a time.

---

## Project Overview

WatchWise is a Python research pipeline with a React/FastAPI demo app. The core experiment asks whether a conditional diffusion candidate generator can improve group-compromise recommendations compared with traditional nearest-neighbor retrieval when both are evaluated under controlled reranking and filtering conditions.

The project is grounded in MovieLens ratings. It trains matrix-factorization user/movie embeddings, forms synthetic groups of real users, trains a conditional diffusion generator over movie embeddings, trains a fairness-aware REINFORCE slate policy, and evaluates recommendations against held-out ratings that were hidden before MF training.

Primary references:

- `AGENTS.md`: repository-wide coding-agent conventions.
- `CLAUDE.md`: Claude Code implementation guardrails.
- Full report materials and the master scientific specification are kept local until they are explicitly released.

## Experiment Design

Five measured approaches are compared on the same held-out groups:

| # | Approach | Candidate generation | Reranker |
| --- | --- | --- | --- |
| 1 | Average baseline | Top-K by mean member rating | None |
| 2 | NN + bandit | Nearest-neighbor retrieval | Greedy fairness selector |
| 3 | Diffusion + bandit | Conditional diffusion | Greedy fairness selector |
| 4 | NN + RL | Nearest-neighbor retrieval | REINFORCE slate-builder |
| 5 | Diffusion + RL | Conditional diffusion | REINFORCE slate-builder |

Controlled comparisons:

- Candidate generation: compare `nn_*` with `diffusion_*` while keeping reranker and filters fixed.
- Reranking: compare `*_greedy` with `*_rl` while keeping the candidate pool and filters fixed.
- Fairness trade-off: sweep `w2`, the reward weight on the worst-off member.

Main metrics:

- Mean relevance and min-member satisfaction.
- Fairness gap between best-served and worst-served members.
- Non-circular held-out NDCG@5 and Hit@5.
- Slate diversity and catalog coverage.

## System Flow

```text
MovieLens ratings + links
-> enriched catalog metadata
-> train/test rating split
-> MF user/movie embeddings
-> random/similar/divergent synthetic groups
-> group taste vector
-> NN or diffusion candidate generation
-> optional Mode 2 hard filters
-> greedy fairness reranker or REINFORCE policy
-> 3-5 movie slate
-> held-out evaluation
```

Mode 2 filters are constraints, not learned signals. OTT availability, runtime, and age checks are applied before scoring when provider constraints are active.

## Repository Layout

```text
watchwise/        config, accelerator, candidates, reward, groups, filters,
                  pipeline, evaluate, coldstart
watchwise/data/   MovieLens loading, TMDb/offline enrichment, text embeddings
watchwise/models/ matrix factorization, diffusion, greedy reranker, RL policy
scripts/          01_prepare_data.py through 06_evaluate.py, run_all.py,
                  07_phase_compare.py, cache/deploy helpers
app/api/          FastAPI backend and DemoEngine
app/frontend/src/ React UI
notebooks/        Kaggle workflow
swiss-grid-ui/    standalone UI prototype, not production app
tests/            pytest smoke/invariant tests
data/             raw downloads and generated caches, gitignored
results/          generated metrics, figures, summaries
```

## Setup

Python dependencies:

```bash
pip install -r requirements.txt
```

Frontend dependencies:

```bash
cd app/frontend
npm install
```

Optional metadata credentials:

```bash
export TMDB_API_KEY=...
# or
export TMDB_READ_ACCESS_TOKEN=...
```

Without TMDb credentials, WatchWise uses deterministic offline fallbacks for runtime, certification, and streaming-provider metadata. MovieLens genres, year, popularity, and ratings remain real.

## Run The Pipeline

Phase 2 is the default and uses MovieLens 25M:

```bash
python scripts/run_all.py --accelerator auto
```

Run the smaller development phase:

```bash
python scripts/run_all.py --phase phase1 --accelerator auto
```

Run stages individually in order:

```bash
python scripts/01_prepare_data.py --phase phase2 --accelerator auto
python scripts/02_train_mf.py --phase phase2 --accelerator auto
python scripts/03_train_diffusion.py --phase phase2 --accelerator auto
python scripts/04_form_groups.py --phase phase2
python scripts/05_train_rl.py --phase phase2 --accelerator auto
python scripts/06_evaluate.py --phase phase2 --accelerator auto
```

Optional phase comparison after both result sets exist:

```bash
python scripts/07_phase_compare.py
```

Generated artifacts:

- `data/raw/<dataset>/`: downloaded MovieLens data.
- `data/cache/<dataset>/`: intermediate caches and trained artifacts.
- `results/<phase>/`: metrics, figures, JSON, and summaries.

## Phases

| Phase | Dataset | Use | Flag |
| --- | --- | --- | --- |
| Phase 2 | `ml-25m` | Default app and scaled final run | default / `--phase phase2` |
| Phase 1 | `ml-latest-small` | Smaller research/development run | `--phase phase1` |

## Accelerator Options

Device handling is centralized in `watchwise/accelerator.py`.

| Environment | Flag |
| --- | --- |
| Auto-detect | `--accelerator auto` |
| CPU / Kaggle None | `--accelerator cpu` |
| Apple Silicon | `--accelerator mps` |
| Single CUDA / Kaggle P100 | `--accelerator cuda` |
| Multi-GPU / Kaggle T4 x2 | `--accelerator cuda_multi` |
| TPU v5e-8 | `--accelerator tpu` |

Model and training code should use `Accelerator` methods for device movement and optimizer steps instead of hard-coding `.cuda()`, `.to("mps")`, or direct `torch_xla` calls.

## Run The App

Start the phase2 React/FastAPI demo:

```bash
./app/start.sh
```

Default local ports:

- Frontend: `http://localhost:18791`
- Backend docs: `http://localhost:18790/docs`

`start.sh` fetches the phase2 cache if needed, installs frontend dependencies if `node_modules/` is missing, starts FastAPI, and starts Vite. Vite proxies frontend `/api/...` calls to the backend.

Fetch the phase2 cache without starting the app:

```bash
./scripts/fetch_cache.sh
```

The published cache is expected at GitHub Release tag `phase2-cache` as `ml-25m-cache.tar.gz`. Override cache source with:

```bash
export WATCHWISE_REPO=owner/repo
export WATCHWISE_CACHE_TAG=phase2-cache
```

For private GitHub releases, set `GITHUB_TOKEN` or `GH_TOKEN` with repository read access before running `./app/start.sh` or `./scripts/fetch_cache.sh`. The fetch script also tries the local Git credential helper when no token environment variable is set.

## App Modes

- Mode 1, fairness stress test: compares baseline and WatchWise methods on measured held-out groups.
- Mode 2, OTT constraints: applies provider, runtime, and age constraints before recommendation.
- Mode 3, cold-start builder: maps declared profiles to proxy MovieLens users and produces illustrative recommendations.

Mode 3 and custom groups are not measured with held-out NDCG/Hit because brand-new profiles have no historical held-out ratings.

## Testing

Run smoke tests after the needed cache/results exist:

```bash
python -m pytest tests/ -q
```

Run the script form:

```bash
python tests/test_smoke.py
```

Validate phase1 explicitly:

```bash
WATCHWISE_PHASE=phase1 python -m pytest tests/ -q
```

There is no frontend test runner. Validate frontend changes with:

```bash
cd app/frontend
npm run build
```

## Implementation Guidelines

- Keep shared tunables, paths, phase defaults, provider aliases, reward weights, and model sizes in `watchwise/config.py`.
- Keep stage scripts CLI-compatible through `scripts/_bootstrap.py`.
- Keep recommendation behavior in `watchwise/pipeline.py::Recommender.recommend`; the app should call the pipeline rather than duplicate logic.
- Keep API behavior in `app/api/engine.py::DemoEngine`; `app/api/main.py` should remain endpoint wiring and startup plumbing.
- Use `CatalogSpace.member_satisfaction` for fairness-facing satisfaction and app "Best for" labels. Raw MF ratings are popularity-dominated and are not the reranker satisfaction signal.
- Preserve non-circular evaluation: train/test holdout happens before MF training, and held-out ratings drive NDCG/Hit.
- Preserve group split discipline: RL train/validation/test groups are disjoint.
- Preserve reward semantics: relevance is mean satisfaction over members and slate; fairness is the worst member's best slate option.
- Keep `data/text_encoder.py` fallback behavior so the pipeline completes without sentence-transformer downloads.
- Treat `swiss-grid-ui/` as design reference only unless explicitly porting it into `app/frontend/src/`.

## Deployment

The VM deployment helper is:

```bash
bash scripts/deploy_gcp_vm.sh
```

It syncs runtime files and the local phase2 cache to a GCP VM, rebuilds the Python environment and frontend, configures FastAPI under systemd behind Nginx, and verifies both health and a real Mode 1 recommendation path. Read the script before changing deployment behavior; most deployment settings are environment-variable driven at the top of the script.

## Security And Generated Files

Do not commit:

- `.env` files, API keys, SSH keys, or other secrets.
- MovieLens downloads in `data/raw/`.
- Generated caches in `data/cache/`.
- Model binaries, cache tarballs, or result artifacts intended for release storage.
- `node_modules/`, `app/frontend/dist/`, virtual environments, or local IDE/tooling files.

Important environment variables:

- `TMDB_API_KEY` or `TMDB_READ_ACCESS_TOKEN`: optional real TMDb enrichment.
- `WATCHWISE_PHASE`: active phase for app/tests where applicable.
- `WATCHWISE_REPO`: GitHub repo used by `scripts/fetch_cache.sh`.
- `WATCHWISE_CACHE_TAG`: GitHub Release tag used by `scripts/fetch_cache.sh`.
- `WATCHWISE_BACKEND_PORT` and `WATCHWISE_FRONTEND_PORT`: local app port overrides.

## Honesty Notes

- Groups are synthetic groupings of real MovieLens users, not real co-viewing households.
- Group satisfaction is a predicted-rating taste-fit proxy; held-out NDCG/Hit provide the non-circular validation.
- Mode 3 cold-start recommendations are illustrative and should be labelled as such.
- Offline metadata fallbacks are deterministic and labelled; they keep the app runnable without external API calls.
