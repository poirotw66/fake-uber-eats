#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export UBEREATS_COORDS_ONLY=1
export UBEREATS_MENUS_ONLY=0
export UBEREATS_COVERS_ONLY=0
export UBEREATS_SKIP_MENU=1
export UBEREATS_MANUAL_LOGIN=0
export UBEREATS_HEADLESS="${UBEREATS_HEADLESS:-1}"
export UBEREATS_MAX_STORES=0
export PYTHONUNBUFFERED=1
# Force slow settings — .env values are too aggressive and trigger rate limits.
export UBEREATS_MENU_WORKERS=1
export UBEREATS_API_INTERVAL=3.0
export UBEREATS_COORDS_SKIP_EXISTING=1
export UBEREATS_EMPTY_RETRIES=2
export UBEREATS_EMPTY_RETRY_WAIT=60
export UBEREATS_RATE_LIMIT_WAIT_MAX=90
export UBEREATS_SESSION_REFRESH_EVERY=35
export UBEREATS_COORDS_RETRY_ROUNDS=2

if [[ -z "${CONDA_DEFAULT_ENV:-}" ]]; then
  if [[ -f "${HOME}/miniconda3/etc/profile.d/conda.sh" ]]; then
    # shellcheck disable=SC1091
    source "${HOME}/miniconda3/etc/profile.d/conda.sh"
    conda activate uber-fake 2>/dev/null || true
  fi
fi

python scripts/scrape_ubereats.py
