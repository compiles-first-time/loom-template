#!/usr/bin/env bash
# loom efficacy — ADR-0054 Phase-1a governed-vs-ungoverned safety-catch measurement.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$ROOT/observability/eval-suite/efficacy/harness.mjs" "$@"
