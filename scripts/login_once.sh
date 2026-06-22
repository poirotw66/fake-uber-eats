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

export UBEREATS_MANUAL_LOGIN=1
export UBEREATS_HEADLESS=0
export UBEREATS_FRESH_LOGIN=1
export UBEREATS_PASSWORD=

if [[ -z "${CONDA_DEFAULT_ENV:-}" ]]; then
  if [[ -f "${HOME}/miniconda3/etc/profile.d/conda.sh" ]]; then
    # shellcheck disable=SC1091
    source "${HOME}/miniconda3/etc/profile.d/conda.sh"
    conda activate uber-fake 2>/dev/null || true
  fi
fi

python scripts/login_ubereats.py
