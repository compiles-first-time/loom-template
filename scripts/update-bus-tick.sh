#!/usr/bin/env bash
# `loom update-bus tick` — POSIX shell wrapper around the Node stub.
# v0.3 receiver (ADR-0057): validates inbox items against schema.json + surfaces
# the Critic queue. Never applies/merges. Feed polling = the research-scout agent.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/scripts/lib/update-bus-tick.mjs"

if [ ! -f "$RUNNER" ]; then
    echo "error: $RUNNER not found" >&2
    exit 2
fi

if ! command -v node >/dev/null 2>&1; then
    echo "error: node not on PATH (Loom v0.2 requires Node 22+)" >&2
    exit 2
fi

cd "$ROOT"
exec node "$RUNNER" "$@"
