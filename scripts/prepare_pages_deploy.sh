#!/usr/bin/env bash
# Build a slim static artifact for GitHub Pages (no dev-only data or JPEG sources).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/_site"

rm -rf "${OUT}"
mkdir -p "${OUT}"

rsync -a \
  --exclude '_site/' \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.claude/' \
  --exclude '.env' \
  --exclude 'docs/' \
  --exclude 'scripts/' \
  --exclude 'app.legacy.js' \
  --exclude 'data/restaurants.json' \
  --exclude 'data/restaurants.enriched.json' \
  --exclude 'data/.ubereats-auth.json' \
  --exclude 'data/store_uuid_map.json' \
  --exclude 'data/debug-*.png' \
  --exclude '*.jpg' \
  --exclude '*.jpeg' \
  --exclude '*.png' \
  "${ROOT}/" "${OUT}/"

echo "Deploy artifact ready at ${OUT}"
du -sh "${OUT}" "${OUT}/assets/images" 2>/dev/null || du -sh "${OUT}"
