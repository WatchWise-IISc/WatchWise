"""WatchWise 2.0 — FastAPI backend for the React frontend.

Exposes the same DemoEngine logic as REST endpoints for the React frontend.
"""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.engine import CURATED_MODE3_FAMILIES, DemoEngine  # noqa: E402

engine: Optional[DemoEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    phase = os.environ.get("WATCHWISE_PHASE", "phase2")
    print(f"[api] loading cached artifacts (phase={phase}) ...")
    engine = DemoEngine(phase=phase)
    print("[api] ready.")
    yield
    engine = None


app = FastAPI(title="WatchWise 2.0 API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:18791", "http://127.0.0.1:18791"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Endpoints                                                                     #
# --------------------------------------------------------------------------- #

@app.get("/api/health")
def health():
    return {"status": "ok", "phase": engine.cfg.phase if engine else None}


@app.get("/api/groups")
def get_groups(kind: str = "divergent", mode: str = "mode1"):
    """Return groups of a given kind (divergent/similar/random), ranked by contrast."""
    choices = engine.group_choices(kind, mode)
    return {"groups": [{"label": label, "gid": gid} for label, gid in choices]}


@app.get("/api/group/{gid}/members")
def get_group_members(gid: int):
    """Return member info for a specific group."""
    info = engine.member_panel_data(gid)
    return info


def _csv_values(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    return [x.strip() for x in value.split(",") if x.strip()]


@app.get("/api/movies/genres")
def get_movie_genres():
    """Return available genres from the active catalog."""
    return {"genres": engine.available_genres()}


@app.get("/api/movies/suggestions")
def get_movie_suggestions(
    genres: Optional[str] = Query(None),
    limit: int = 6,
):
    """Return most-rated and newest movies matching selected genres."""
    return engine.movie_suggestions(_csv_values(genres), limit=limit)


@app.get("/api/movies/search")
def search_movies(
    q: str = Query(""),
    genres: Optional[str] = Query(None),
    limit: int = 8,
):
    """Search MovieLens titles and return fallback advice when absent."""
    return engine.search_movies(q, _csv_values(genres), limit=limit)


@app.get("/api/mode1/recommend")
def mode1_recommend(gid: int):
    """Run Mode 1: all methods comparison on a group."""
    result = engine.run_mode1_api(gid)
    return result


@app.post("/api/mode1/custom")
def mode1_recommend_custom(profiles: List[Dict[str, Any]] = Body(...)):
    """Run Mode 1 cold-start comparison for a user-defined group."""
    result = engine.run_mode1_custom_api(profiles)
    return result


@app.get("/api/mode2/recommend")
def mode2_recommend(
    gid: int,
    allow_teen: bool = True,
    providers: Optional[str] = Query(None),
):
    """Run Mode 2: provider-filtered recommendation."""
    selected_providers = None
    if providers:
        selected_providers = [p.strip() for p in providers.split(",") if p.strip()]
    result = engine.run_mode2_api(gid, allow_teen, selected_providers)
    return result


@app.post("/api/mode2/custom")
def mode2_recommend_custom(
    profiles: List[Dict[str, Any]] = Body(...),
    allow_teen: bool = True,
    providers: Optional[str] = Query(None),
):
    """Run Mode 2 constrained recommendation for a user-defined group."""
    selected_providers = _csv_values(providers)
    result = engine.run_mode2_custom_api(profiles, allow_teen, selected_providers)
    return result


@app.get("/api/mode3/families")
def get_families():
    """Return available cold-start family presets."""
    from watchwise.coldstart import PRESET_FAMILIES
    families = []
    for name in CURATED_MODE3_FAMILIES:
        profiles = PRESET_FAMILIES[name]
        families.append({
            "name": name,
            "members": [{"name": p.name, "genres": p.genres} for p in profiles],
        })
    return {"families": families}


@app.get("/api/mode3/recommend")
def mode3_recommend(family: str):
    """Run Mode 3: cold-start family recommendation (preset)."""
    result = engine.run_mode3_api(family)
    return result


def _mode3_custom_result(profiles: List[Dict[str, Any]]):
    if engine is None:
        raise HTTPException(
            status_code=503,
            detail="Engine not initialized. Backend may still be starting or cache is missing.",
        )
    return engine.run_mode3_custom_api(profiles)


@app.post("/api/mode3/recommend")
def mode3_recommend_custom_compat(profiles: List[Dict[str, Any]] = Body(...)):
    """Compatibility path for custom cold-start clients that POST to /recommend."""
    return _mode3_custom_result(profiles)


@app.post("/api/mode3/custom")
def mode3_recommend_custom(profiles: List[Dict[str, Any]] = Body(...)):
    """Run Mode 3 cold-start from a custom list of members: [{name, genres}, ...]. Fully user-defined."""
    return _mode3_custom_result(profiles)


@app.get("/api/results/summary")
def get_results_summary():
    """Return cached evaluation summary data."""
    return engine.get_summary()
