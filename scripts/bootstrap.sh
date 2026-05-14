#!/usr/bin/env bash
# Loom v0.1 manual bootstrap helper (POSIX shell)
#
# At v0.1 the bootstrap is manual. This script performs the deterministic steps
# (placeholder substitution, smoke checks) but leaves agent decisions to you.
#
# Usage:
#   ./scripts/bootstrap.sh <project-name> [description] [user-name]

set -euo pipefail

PROJECT_NAME="${1:-}"
DESCRIPTION="${2:-}"
USER_NAME="${3:-${USER:-${USERNAME:-user}}}"

if [ -z "$PROJECT_NAME" ]; then
    echo "Usage: $0 <project-name> [description] [user-name]" >&2
    exit 1
fi

ROOT="$(pwd)"
DATE="$(date +%Y-%m-%d)"

echo "Loom v0.1 bootstrap"
echo "  Project: $PROJECT_NAME"
echo "  Root:    $ROOT"
echo ""

# --- 1. Placeholder substitution ---------------------------------------------
PLACEHOLDER_FILES=(
    "README.md"
    "CLAUDE.md"
    "AGENTS.md"
    "loom-spec.md"
    "constitution/kernel-v6.md"
    "constitution/local-rules.md"
    "memory/self-knowledge.md"
    "tools/mcp-servers/config.yaml"
    "observability/langfuse-config.yaml"
)

# Use a temp suffix that's unlikely to collide on either GNU or BSD sed
SED_INPLACE() {
    if sed --version >/dev/null 2>&1; then
        sed -i -- "$@"
    else
        sed -i '' -- "$@"
    fi
}

for f in "${PLACEHOLDER_FILES[@]}"; do
    if [ ! -f "$ROOT/$f" ]; then
        echo "  skip (missing): $f"
        continue
    fi
    SED_INPLACE "s|<PROJECT_NAME>|$PROJECT_NAME|g" "$ROOT/$f"
    SED_INPLACE "s|<USER_NAME>|$USER_NAME|g" "$ROOT/$f"
    SED_INPLACE "s|<YYYY-MM-DD>|$DATE|g" "$ROOT/$f"
    echo "  stamped: $f"
done

# --- 2. Smoke checks ---------------------------------------------------------
echo ""
echo "Running smoke checks..."

FAILURES=()

REQUIRED_DIRS=(
    "constitution" "layers" "agents/hr" "agents/eac" "agents/human-replica"
    "agents/critic" "agents/memory-keeper" "agents/constitution-service"
    "memory/event-log" "memory/skills" "tools/mcp-servers"
    "orchestration" "observability/eval-suite" "adr" "lessons-learned"
    "update-bus/inbox" "update-bus/archive" "spec"
)
for d in "${REQUIRED_DIRS[@]}"; do
    [ -d "$ROOT/$d" ] || FAILURES+=("missing directory: $d")
done

REQUIRED_FILES=(
    "README.md" "CLAUDE.md" "AGENTS.md" "loom-spec.md" "LICENSE"
    ".gitignore" ".env.example"
    "constitution/kernel-v6.md" "constitution/local-rules.md"
    "spec/loom-spec-v0.1-full.md"
    "tools/mcp-servers/config.yaml"
    "observability/langfuse-config.yaml"
    "adr/0000-template.md" "adr/0001-loom-version.md" "adr/0002-orchestration-framework.md"
)
for f in "${REQUIRED_FILES[@]}"; do
    [ -f "$ROOT/$f" ] || FAILURES+=("missing file: $f")
done

# Size discipline
CLAUDE_SIZE=$(wc -c < "$ROOT/CLAUDE.md" 2>/dev/null || echo 0)
[ "$CLAUDE_SIZE" -gt 10240 ] && FAILURES+=("CLAUDE.md exceeds 10 KB cap ($((CLAUDE_SIZE/1024)) KB)")
AGENTS_SIZE=$(wc -c < "$ROOT/AGENTS.md" 2>/dev/null || echo 0)
[ "$AGENTS_SIZE" -gt 5120 ] && FAILURES+=("AGENTS.md exceeds 5 KB cap ($((AGENTS_SIZE/1024)) KB)")

if [ "${#FAILURES[@]}" -gt 0 ]; then
    echo ""
    echo "Smoke checks FAILED:" >&2
    for x in "${FAILURES[@]}"; do echo "  - $x" >&2; done
    exit 1
fi

echo "  All smoke checks passed."

# --- 3. Next steps -----------------------------------------------------------
echo ""
echo "Bootstrap complete. Next steps:"
echo "  1. Install your canonical Trajectory Kernel V6 text into constitution/kernel-v6.md"
echo "  2. Edit CLAUDE.md to describe this project's specific goals"
echo "  3. Decide full-6 vs minimal-3 agent set (see layers/L2-agents.md)"
echo "  4. Copy .env.example to .env and fill in API keys"
echo "  5. Confirm or override ADR-0002 (orchestration framework)"
echo "  6. git init && git add . && git commit -m 'Loom v0.1 scaffold'"
echo ""
echo "Loom version: 0.1.0 | Kernel version: v6"
