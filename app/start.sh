#!/usr/bin/env bash
# Start WatchWise 2.0 — FastAPI backend + React frontend
# Usage: ./app/start.sh

set -e
cd "$(dirname "$0")/.."

if [ "$#" -ne 0 ]; then
  echo "Usage: ./app/start.sh" >&2
  exit 2
fi

PHASE="phase2"
export WATCHWISE_PHASE="$PHASE"

# Custom ports chosen to reduce collisions with other dev servers.
BACKEND_PORT="${WATCHWISE_BACKEND_PORT:-18790}"
FRONTEND_PORT="${WATCHWISE_FRONTEND_PORT:-18791}"
export WATCHWISE_BACKEND_PORT="$BACKEND_PORT"
export WATCHWISE_FRONTEND_PORT="$FRONTEND_PORT"
export VITE_FRONTEND_PORT="$FRONTEND_PORT"
export VITE_API_TARGET="${VITE_API_TARGET:-http://localhost:$BACKEND_PORT}"

echo "=== WatchWise 2.0 (phase=$PHASE) ==="
echo ""

# Ensure cached model artifacts exist (downloads from the GitHub Release on first run;
# data/cache/ is gitignored because the binaries are too large for plain git).
bash scripts/fetch_cache.sh

# Check if node_modules exists
if [ ! -d "app/frontend/node_modules" ]; then
  echo "[setup] Installing frontend dependencies..."
  cd app/frontend && npm install && cd ../..
fi

# Kill stale processes on the custom ports we use.
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
