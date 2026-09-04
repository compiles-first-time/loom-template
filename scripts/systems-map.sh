#!/usr/bin/env bash
# loom systems-map — the systems atlas (ADR-0065): validate the registry, answer
# impact questions (affects / affected-by / impact), render ATLAS.md + explorer.
#   scripts/systems-map.sh validate
#   scripts/systems-map.sh impact <system_id>
#   scripts/systems-map.sh render [--check]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
exec node "$ROOT/scripts/lib/systems-map.mjs" "$@"
