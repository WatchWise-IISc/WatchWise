#!/usr/bin/env bash
# Deploy WatchWise to a single Google Cloud VM.
#
# The script runs from the local repository. It stops the remote WatchWise
# services, backs up the previous deployment, syncs app/runtime files, installs
# dependencies, builds the React UI, and starts FastAPI behind Nginx.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE_USER="${REMOTE_USER:-iiscwatchwise}"
REMOTE_HOST="${REMOTE_HOST:-34.14.210.127}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/watchwise-claude}"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"

REMOTE_DIR="${REMOTE_DIR:-/mnt/watchwise-data/watchwise}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/watchwise-data/watchwise-backups}"
SERVICE_NAME="${SERVICE_NAME:-watchwise-api}"
WATCHWISE_PHASE="${WATCHWISE_PHASE:-phase2}"
API_PORT="${API_PORT:-18790}"
API_WORKERS="${API_WORKERS:-2}"
BACKUP_KEEP="${BACKUP_KEEP:-2}"

SSH_OPTS=(
  -i "$SSH_KEY"
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
)
RSYNC_RSH="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_local_file() {
  if [ ! -e "$1" ]; then
    printf 'Missing required local path: %s\n' "$1" >&2
    exit 1
  fi
}

require_local_file "$SSH_KEY"
require_local_file "requirements.txt"
require_local_file "app/api/main.py"
require_local_file "app/frontend/package-lock.json"
require_local_file "watchwise/config.py"
require_local_file "data/cache/ml-25m/mf.npz"
require_local_file "data/cache/ml-25m/text_embeddings.npy"
require_local_file "data/cache/ml-25m/catalog.parquet"
require_local_file "data/cache/ml-25m/diffusion.pt"
require_local_file "data/cache/ml-25m/rl_policy.pt"
require_local_file "data/cache/ml-25m/groups.json"

if ! command -v rsync >/dev/null 2>&1; then
  printf 'rsync is required locally. Install it and rerun this script.\n' >&2
  exit 1
fi

SYNC_PATHS=(
  AGENTS.md
  CLAUDE.md
  README.md
  WATCHWISE_MASTER_SPEC.md
  requirements.txt
  app
  watchwise
  scripts
  results
  data/cache/ml-25m
)

log "Preparing remote VM packages and backup area"
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "REMOTE_DIR='$REMOTE_DIR' BACKUP_ROOT='$BACKUP_ROOT' SERVICE_NAME='$SERVICE_NAME' BACKUP_KEEP='$BACKUP_KEEP' bash -s" <<'REMOTE_PREP'
set -euo pipefail

sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential ca-certificates curl git nginx nodejs npm python3 python3-pip python3-venv rsync
sudo apt-get clean

if [[ "$REMOTE_DIR" == /mnt/watchwise-data/* ]] && ! findmnt /mnt/watchwise-data >/dev/null 2>&1; then
  echo "[remote] /mnt/watchwise-data is not mounted. Mount the 100 GB data disk before deploying." >&2
  exit 1
fi

echo "[remote] stopping WatchWise services"
if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  sudo systemctl stop "$SERVICE_NAME" || true
fi
sudo systemctl stop nginx || true

TS="$(date '+%Y%m%d-%H%M%S')"
sudo mkdir -p "$BACKUP_ROOT"
if [ -d "$REMOTE_DIR" ]; then
  sudo mkdir -p "$BACKUP_ROOT/watchwise-$TS"
  sudo rsync -a --delete \
    --exclude '.venv/' \
    --exclude 'app/frontend/node_modules/' \
    --exclude 'app/frontend/dist/' \
    "$REMOTE_DIR/" "$BACKUP_ROOT/watchwise-$TS/"
  sudo rm -rf "$REMOTE_DIR"
  echo "[remote] backup: $BACKUP_ROOT/watchwise-$TS"
fi

sudo find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'watchwise-*' \
  | sort -r \
  | awk "NR>${BACKUP_KEEP}" \
  | xargs -r sudo rm -rf

sudo mkdir -p "$REMOTE_DIR"
sudo chown -R "$(id -un):$(id -gn)" "$REMOTE_DIR"
REMOTE_PREP

log "Syncing repository runtime files to $REMOTE:$REMOTE_DIR"
rsync -az --delete --relative \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude 'app/frontend/node_modules/' \
  --exclude 'app/frontend/dist/' \
  --exclude 'data/raw/' \
  --exclude 'data/cache/ml-latest-small/' \
  -e "$RSYNC_RSH" \
  "${SYNC_PATHS[@]}" \
  "$REMOTE:$REMOTE_DIR/"

log "Installing dependencies, building frontend, and configuring services"
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "REMOTE_DIR='$REMOTE_DIR' SERVICE_NAME='$SERVICE_NAME' WATCHWISE_PHASE='$WATCHWISE_PHASE' API_PORT='$API_PORT' API_WORKERS='$API_WORKERS' bash -s" <<'REMOTE_SETUP'
set -euo pipefail
cd "$REMOTE_DIR"

if [ ! -f "data/cache/ml-25m/mf.npz" ]; then
  echo "[remote] missing phase2 cache after sync" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[remote] Node.js 18+ is required; found $(node --version 2>/dev/null || echo missing)" >&2
  exit 1
fi

python3 -m venv .venv
.venv/bin/python -m pip install --no-cache-dir --upgrade pip wheel
.venv/bin/python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu 'torch>=2.0'
.venv/bin/python -m pip install --no-cache-dir -r requirements.txt

cd app/frontend
npm ci --no-audit --cache /tmp/watchwise-npm-cache
npm run build
rm -rf /tmp/watchwise-npm-cache
cd "$REMOTE_DIR"

REMOTE_USER="$(id -un)"
REMOTE_GROUP="$(id -gn)"

sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<SERVICE
[Unit]
Description=WatchWise FastAPI service
After=network.target

[Service]
Type=simple
User=${REMOTE_USER}
Group=${REMOTE_GROUP}
WorkingDirectory=${REMOTE_DIR}
Environment=WATCHWISE_PHASE=${WATCHWISE_PHASE}
Environment=PYTHONUNBUFFERED=1
Environment=OMP_NUM_THREADS=2
Environment=OPENBLAS_NUM_THREADS=2
ExecStart=${REMOTE_DIR}/.venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port ${API_PORT} --workers ${API_WORKERS}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo tee /etc/nginx/sites-available/watchwise >/dev/null <<NGINX
server {
    listen 80 default_server;
    server_name _;

    root ${REMOTE_DIR}/app/frontend/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 180s;
        proxy_connect_timeout 10s;
    }
}
NGINX

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn /etc/nginx/sites-available/watchwise /etc/nginx/sites-enabled/watchwise
sudo nginx -t

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "[remote] waiting for API health"
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/tmp/watchwise-health.json; then
    cat /tmp/watchwise-health.json
    echo
    break
  fi
  sleep 2
done

curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null || {
  echo "[remote] API did not become healthy. Recent logs:" >&2
  sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager >&2
  exit 1
}

curl -fsS "http://127.0.0.1/api/health" >/dev/null || {
  echo "[remote] Nginx proxy health check failed" >&2
  sudo nginx -T >&2
  exit 1
}

echo "[remote] deployment complete"
REMOTE_SETUP

log "Deployment complete"
printf 'App:  http://%s/\nAPI:  http://%s/api/health\n' "$REMOTE_HOST" "$REMOTE_HOST"
