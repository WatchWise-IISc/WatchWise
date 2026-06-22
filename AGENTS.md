# Repository Guidelines

## Project Structure & Module Organization
WatchWise is a Python research pipeline with a React/FastAPI demo app. Core package code lives in `watchwise/`: data loading and enrichment under `watchwise/data/`, model implementations under `watchwise/models/`, and shared pipeline, evaluation, filtering, reward, and group logic at package root. Pipeline entry points are in `scripts/` (`01_prepare_data.py` through `07_phase_compare.py`, plus `run_all.py`). The app is split between `app/api/` for FastAPI and `app/frontend/src/` for React components. Smoke tests are in `tests/`. Generated caches and outputs belong in `data/cache/` and `results/`; avoid committing large model artifacts.

## Build, Test, and Development Commands
- `pip install -r requirements.txt`: install Python training, evaluation, and API dependencies.
- `python scripts/run_all.py --accelerator auto`: run the full download, training, group formation, RL, and evaluation pipeline.
- `python scripts/run_all.py --phase phase2 --accelerator auto`: regenerate the scaled MovieLens cache if release artifacts are unavailable.
- `./app/start.sh --phase phase1`: start the FastAPI backend on `:18790` and Vite frontend on `:18791`; omit the phase flag for the phase2 default.
- `cd app/frontend && npm install && npm run build`: install frontend dependencies and build the React app.
- `python -m pytest tests/ -q`: run smoke tests after required cached artifacts exist. Use `WATCHWISE_PHASE=phase2` to validate phase2 artifacts.

## Coding Style & Naming Conventions
Use Python 3 with 4-space indentation, type hints where they clarify interfaces, and module-level constants for shared configuration. Keep tunables in `watchwise/config.py` rather than scattering literals. Name scripts with ordered numeric prefixes when they are pipeline stages. In React, use ES modules, PascalCase component filenames such as `Mode1.jsx`, and Tailwind utility classes consistent with existing components.

## Testing Guidelines
Tests assert contracts and scientific invariants, not exact metric snapshots. Add focused tests under `tests/test_*.py`, and prefer deterministic fixtures or cached artifacts over live downloads. When changing recommendation behavior, run the relevant phase pipeline before smoke tests.

## Commit & Pull Request Guidelines
History uses short, imperative commit subjects, for example `Add React + FastAPI app backend and frontend source`. Keep commits scoped to one change. Pull requests should summarize behavior changes, list commands run, note dataset phase affected, link issues when available, and include screenshots for frontend changes.

## Security & Configuration Tips
Do not commit secrets, local caches, downloaded MovieLens archives, or model binaries. `TMDB_API_KEY` is optional; without it the pipeline uses deterministic offline metadata fallbacks.
