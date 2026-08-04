#!/usr/bin/env bash
# `loom flush` — read-only system-flush reporter. Surfaces gaps (broken links,
# untested libs, fuzz crashes, dead refs); CHANGES NOTHING. Fixes are a separate,
# user-consented step (Rule 19). See scripts/lib/flush.mjs and ADR-0058-era notes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v node >/dev/null 2>&1; then echo "error: node not on PATH" >&2; exit 2; fi
cd "$ROOT"
exec node "$ROOT/scripts/lib/flush.mjs" "$ROOT"
