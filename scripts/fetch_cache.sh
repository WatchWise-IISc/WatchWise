#!/usr/bin/env bash
# Fetch cached model artifacts so the app runs from a clone without re-running the
# pipeline. The large binaries (mf.npz, text_embeddings.npy, train_ratings.parquet,
# ...) are too big for plain git, so they live on a GitHub Release and data/cache/
# stays gitignored. This pulls the phase's cache tarball into data/cache/<dataset>/
# only if it isn't already present.
#
# Usage: ./scripts/fetch_cache.sh [phase2]   (default: $WATCHWISE_PHASE or phase2)
set -e
cd "$(dirname "$0")/.."

PHASE="${1:-${WATCHWISE_PHASE:-phase2}}"
if [ "$PHASE" != "phase2" ]; then
  echo "[fetch] unknown phase '$PHASE' (expected phase2)" >&2
  exit 1
fi
DATASET="ml-25m"

# mf.npz is one of the required large files; its presence means the cache is in place.
if [ -f "data/cache/$DATASET/mf.npz" ]; then
  echo "[fetch] cache already present for $DATASET — skipping download."
  exit 0
fi

REPO="${WATCHWISE_REPO:-WatchWise-IISc/WatchWise}"
TAG="${WATCHWISE_CACHE_TAG:-phase2-cache}"
ASSET="$DATASET-cache.tar.gz"
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ] && command -v git >/dev/null 2>&1; then
  TOKEN="$(printf 'protocol=https\nhost=github.com\nusername=kvamsi-iisc\n\n' \
    | git credential fill 2>/dev/null \
    | awk -F= '$1 == "password" { sub(/^password=/, ""); print; exit }')"
fi
CURL_AUTH_ARGS=()
if [ -n "$TOKEN" ]; then
  CURL_AUTH_ARGS=(-H "Authorization: Bearer $TOKEN")
fi

echo "[fetch] downloading $ASSET (~416 MB) from release '$TAG' of $REPO ..."
mkdir -p data/cache
TMP="$(mktemp -t ww-cache).tar.gz"
API_TMP=""
trap 'rm -f "$TMP" "$API_TMP"' EXIT
if ! curl -fL --progress-bar "${CURL_AUTH_ARGS[@]}" "$URL" -o "$TMP"; then
  if [ -n "$TOKEN" ]; then
    echo "[fetch] direct release URL failed; trying authenticated GitHub API asset download ..."
    API_TMP="$(mktemp -t ww-release).json"
    API_URL="https://api.github.com/repos/$REPO/releases/tags/$TAG"
    ASSET_API_URL="$(curl -fsSL \
      "${CURL_AUTH_ARGS[@]}" \
      -H 'Accept: application/vnd.github+json' \
      "$API_URL" \
      | python3 -c 'import json, sys; asset_name = sys.argv[1]; release = json.load(sys.stdin); print(next((asset.get("url", "") for asset in release.get("assets", []) if asset.get("name") == asset_name), ""))' "$ASSET")"
    if [ -n "$ASSET_API_URL" ] && curl -fL --progress-bar \
      "${CURL_AUTH_ARGS[@]}" \
      -H 'Accept: application/octet-stream' \
      "$ASSET_API_URL" \
      -o "$TMP"; then
      unset TOKEN
      echo "[fetch] authenticated release asset downloaded."
    else
      unset TOKEN
      echo "[fetch] authenticated release asset download failed." >&2
      exit 1
    fi
  else
    unset TOKEN
  echo "[fetch] download failed. Confirm the Release '$TAG' exists with asset '$ASSET',"
    echo "        the repo is public or set GITHUB_TOKEN/GH_TOKEN for a private repo. URL: $URL"
    exit 1
  fi
fi
unset TOKEN
echo "[fetch] extracting into data/cache/ ..."
tar -xzf "$TMP" -C data/cache
echo "[fetch] done: data/cache/$DATASET is ready."
