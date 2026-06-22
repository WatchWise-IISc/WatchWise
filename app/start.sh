#!/usr/bin/env bash
# Start WatchWise 2.0 — FastAPI backend + React frontend
# Usage: ./app/start.sh [--phase phase1|phase2]

set -e
cd "$(dirname "$0")/.."

PHASE="${WATCHWISE_PHASE:-phase2}"
for arg in "$@"; do
  case $arg in
    --phase=*) PHASE="${arg#*=}" ;;
    --phase) shift; PHASE="$1" ;;
  esac
done

export WATCHWISE_PHASE="$PHASE"

echo "=== WatchWise 2.0 (phase=$PHASE) ==="
echo ""

# Ensure cached model artifacts exist (downloads from the GitHub Release on first run;
# data/cache/ is gitignored because the binaries are too large for plain git).
bash scripts/fetch_cache.sh "$PHASE"

# Check if node_modules exists
if [ ! -d "app/frontend/node_modules" ]; then
  echo "[setup] Installing frontend dependencies..."
  cd app/frontend && npm install && cd ../..
fi

echo "[start] Starting FastAPI backend on :18790 ..."
uvicorn app.api.main:app --host 0.0.0.0 --port 18790 --reload &
BACKEND_PID=$!

echo "[start] Starting React frontend on :5173 ..."
cd app/frontend && npm run dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo "=== Ready ==="
echo "  Frontend: http://localhost:18791"
echo "  Backend:  http://localhost:18790/docs"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
