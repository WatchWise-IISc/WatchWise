#!/usr/bin/env bash
# Fetch cached model artifacts so the app runs from a clone without re-running the
# pipeline. The large binaries (mf.npz, text_embeddings.npy, train_ratings.parquet,
# ...) are too big for plain git, so they live on a GitHub Release and data/cache/
# stays gitignored. This pulls the phase's cache tarball into data/cache/<dataset>/
# only if it isn't already present.
#
# Usage: ./scripts/fetch_cache.sh [phase1|phase2]   (default: $WATCHWISE_PHASE or phase2)
set -e
cd "$(dirname "$0")/.."

PHASE="${1:-${WATCHWISE_PHASE:-phase2}}"
case "$PHASE" in
  phase1) DATASET="ml-latest-small" ;;
  phase2) DATASET="ml-25m" ;;
  *) echo "[fetch] unknown phase '$PHASE' (expected phase1|phase2)"; exit 1 ;;
esac

# mf.npz is one of the required large files; its presence means the cache is in place.
if [ -f "data/cache/$DATASET/mf.npz" ]; then
  echo "[fetch] cache already present for $DATASET — skipping download."
  exit 0
fi

REPO="${WATCHWISE_REPO:-kvamsi-iisc/WatchWise}"
TAG="${WATCHWISE_CACHE_TAG:-phase2-cache}"
ASSET="$DATASET-cache.tar.gz"
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"

# Only the phase2 (ml-25m) cache is published as a Release asset. For phase1, the
# pipeline regenerates the cache quickly on ml-latest-small.
if [ "$DATASET" != "ml-25m" ]; then
  echo "[fetch] no published cache for $DATASET. Generate it with the pipeline:"
  echo "        python scripts/run_all.py --phase $PHASE --accelerator auto"
  exit 1
fi

echo "[fetch] downloading $ASSET (~416 MB) from release '$TAG' of $REPO ..."
mkdir -p data/cache
TMP="$(mktemp -t ww-cache).tar.gz"
trap 'rm -f "$TMP"' EXIT
if ! curl -fL --progress-bar "$URL" -o "$TMP"; then
  echo "[fetch] download failed. Confirm the Release '$TAG' exists with asset '$ASSET',"
  echo "        the repo is public, and you have network access. URL: $URL"
  exit 1
fi
echo "[fetch] extracting into data/cache/ ..."
tar -xzf "$TMP" -C data/cache
echo "[fetch] done: data/cache/$DATASET is ready."
