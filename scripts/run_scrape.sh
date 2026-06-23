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

# Prefer active conda env; fallback to system python
if [[ -z "${CONDA_DEFAULT_ENV:-}" ]]; then
  if [[ -f "${HOME}/miniconda3/etc/profile.d/conda.sh" ]]; then
    # shellcheck disable=SC1091
    source "${HOME}/miniconda3/etc/profile.d/conda.sh"
    conda activate uber-fake 2>/dev/null || true
  fi
fi

# Login / debug: always show browser when manual OTP is enabled
if [[ "${UBEREATS_MANUAL_LOGIN:-}" == "1" ]]; then
  export UBEREATS_HEADLESS=0
fi

python -m playwright install chromium
python scripts/scrape_ubereats.py
python scripts/build_feed_index.py
