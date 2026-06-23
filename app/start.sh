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

# Custom ports chosen to avoid the very common defaults (Vite 5173, uvicorn 8000)
# and reduce collisions with other dev servers.
BACKEND_PORT=18790
FRONTEND_PORT=18791

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

# Kill stale processes on the custom ports we use (avoids "address already in use"
# and surprises from previous runs on 5173/8000 or leftover uvicorn/vite).
echo "[start] Cleaning up any stale listeners on :$BACKEND_PORT and :$FRONTEND_PORT..."
for p in $BACKEND_PORT $FRONTEND_PORT; do
  pids=$(lsof -ti:$p 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[start]   Killing stale PID(s) on :$p -> $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.3
  fi
done

echo "[start] Starting FastAPI backend on :$BACKEND_PORT ..."
uvicorn app.api.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!

echo "[start] Starting React frontend on :$FRONTEND_PORT (vite.config.js) ..."
cd app/frontend && npm run dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo "=== Ready ==="
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT/docs"
echo ""
echo "  (Vite proxies /api/* -> backend :$BACKEND_PORT; CORS restricted to localhost:$FRONTEND_PORT)"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
