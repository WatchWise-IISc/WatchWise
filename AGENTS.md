# Repository Guidelines

## Documentation Scope
Keep this file focused on durable repository conventions for coding agents. Use `README.md` for the runnable overview, `WATCHWISE_MASTER_SPEC.md` for the scientific contract, `REPORT.md` for final results, and `CLAUDE.md` for Claude-specific implementation guardrails. Do not duplicate long explanations, metric tables, or deployment runbooks here.

## Project Structure
WatchWise is a Python research pipeline with a React/FastAPI demo app. Core package code lives in `watchwise/`: `data/` loads and enriches MovieLens, `models/` contains MF, diffusion, reranker, and RL implementations, and package-root modules cover acceleration, candidates, rewards, groups, filtering, evaluation, cold-start, and end-to-end recommendation. Pipeline entry points are in `scripts/` (`01_prepare_data.py` through `06_evaluate.py`, optional `07_phase_compare.py`, plus `run_all.py`). The app is split between `app/api/` and `app/frontend/src/`. `notebooks/` holds the Kaggle workflow, `swiss-grid-ui/` is a standalone visual prototype, and smoke tests are in `tests/`.

Generated data belongs in `data/raw/`, `data/cache/<dataset>/`, and `results/<phase>/`; treat those artifacts as regenerable or fetched, not source.

## Commands
- `pip install -r requirements.txt`: install Python training, evaluation, and API dependencies.
- `python scripts/run_all.py --accelerator auto`: run stages 1-6 for default `phase2` (`ml-25m`).
- `python scripts/run_all.py --phase phase1 --accelerator auto`: run the smaller `ml-latest-small` development phase.
- `python scripts/07_phase_compare.py`: compare existing phase1 and phase2 result files.
- `./scripts/fetch_cache.sh`: fetch the published phase2 cache when available.
- `./app/start.sh`: start the phase2 app on backend `:18790` and frontend `:18791`.
- `cd app/frontend && npm install && npm run build`: install frontend dependencies and build the Vite app.
- `python -m pytest tests/ -q`: run smoke tests after the required cached artifacts exist.

## Coding Style
Use Python 3 with 4-space indentation, type hints where they clarify interfaces, and module-level constants for shared configuration. Keep tunables in `watchwise/config.py`; stage scripts should use `_bootstrap.parse_args()` for shared `--phase`, `--accelerator`, `--no-text-encoder`, and `--seed` flags. Use `watchwise/accelerator.py` instead of hard-coding device calls in model or training code.

In React, use ES modules, PascalCase component filenames such as `Mode1.jsx`, Tailwind utilities consistent with existing components, and `lucide-react` icons where applicable. The live app is under `app/frontend/src/`; do not wire `swiss-grid-ui/` into production unless explicitly porting that prototype.

## Testing
Tests use `pytest` and assert contracts and scientific invariants, not exact metric snapshots. Add focused tests under `tests/test_*.py`, prefer deterministic fixtures or cached artifacts over live downloads, and run the relevant phase pipeline before smoke tests when recommendation behavior changes. There is no frontend test script; validate UI changes with `npm run build` and, when practical, the local app.

## Git And Security
Use short, action-oriented commit subjects and keep commits scoped to one change. Pull requests should summarize behavior changes, list commands run, note the affected dataset phase, link issues when available, and include screenshots for frontend changes.

Do not commit secrets, local caches, downloaded MovieLens archives, model binaries, `node_modules/`, frontend builds, release cache tarballs, or local virtual environments. `TMDB_API_KEY` or `TMDB_READ_ACCESS_TOKEN` are optional; without them the pipeline uses deterministic offline metadata fallbacks. `WATCHWISE_PHASE`, `WATCHWISE_REPO`, and `WATCHWISE_CACHE_TAG` control app/cache behavior.
