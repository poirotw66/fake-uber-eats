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

export UBEREATS_MENUS_ONLY=1
export UBEREATS_SKIP_MENU=0
export UBEREATS_MANUAL_LOGIN=0
export UBEREATS_HEADLESS="${UBEREATS_HEADLESS:-1}"
export PYTHONUNBUFFERED=1

# Parallel menu scrape (default 4 workers; set to 1 for single-threaded)
export UBEREATS_MENU_WORKERS="${UBEREATS_MENU_WORKERS:-4}"
export UBEREATS_API_INTERVAL="${UBEREATS_API_INTERVAL:-0.6}"
export UBEREATS_FEED_PAGES="${UBEREATS_FEED_PAGES:-12}"

if [[ -z "${CONDA_DEFAULT_ENV:-}" ]]; then
  if [[ -f "${HOME}/miniconda3/etc/profile.d/conda.sh" ]]; then
    # shellcheck disable=SC1091
    source "${HOME}/miniconda3/etc/profile.d/conda.sh"
    conda activate uber-fake 2>/dev/null || true
  fi
fi

python scripts/scrape_ubereats.py
