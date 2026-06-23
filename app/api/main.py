"""WatchWise 2.0 — FastAPI backend for the React frontend.

Exposes the same DemoEngine logic as REST endpoints for the React frontend.
"""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.engine import DemoEngine  # noqa: E402

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
def get_groups(kind: str = "divergent"):
    """Return groups of a given kind (divergent/similar/random), ranked by contrast."""
    choices = engine.group_choices(kind)
    return {"groups": [{"label": label, "gid": gid} for label, gid in choices]}


@app.get("/api/group/{gid}/members")
def get_group_members(gid: int):
    """Return member info for a specific group."""
    info = engine.member_panel_data(gid)
    return info


@app.get("/api/mode1/recommend")
def mode1_recommend(gid: int):
    """Run Mode 1: all methods comparison on a group."""
    result = engine.run_mode1_api(gid)
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


@app.get("/api/mode3/families")
def get_families():
    """Return available cold-start family presets."""
    from watchwise.coldstart import PRESET_FAMILIES
    families = []
    for name, profiles in PRESET_FAMILIES.items():
        families.append({
            "name": name,
            "members": [{"name": p.name, "genres": p.genres} for p in profiles],
        })
    return {"families": families}


@app.get("/api/mode3/recommend")
def mode3_recommend(family: str):
    """Run Mode 3: cold-start family recommendation."""
    result = engine.run_mode3_api(family)
    return result


@app.get("/api/results/summary")
def get_results_summary():
    """Return cached evaluation summary data."""
    return engine.get_summary()
