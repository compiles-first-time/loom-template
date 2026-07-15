#!/usr/bin/env bash
# loom lessons — Phase 0 (ADR-0055): search local lessons + validate their schema.
#   scripts/lessons.sh search "<query>" [--domain d --stack s --platform p]
#   scripts/lessons.sh validate
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/scripts/lib/lessons.mjs" "$@"
