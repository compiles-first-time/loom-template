# Discovered runtime

> **Auto-generated** by `scripts/discover-runtime.{sh,ps1}` at SessionStart and at bootstrap. Per [ADR-0020](../adr/0020-runtime-discovery.md).

> Manual additions: write below the `<!-- end-of-generated -->` marker. The auto-generated section above will be overwritten on next run; your manual section will be preserved.

Generated: 2026-05-19T01:19:18.375Z

## MCP servers available to this Claude Code installation

_No MCP servers discovered._ Loom checked these locations:

- `$LOOM_MCP_CONFIG_PATH` (env override)
- `~/.claude/mcp.json`
- `$XDG_CONFIG_HOME/claude/mcp.json`
- `~/.config/claude/mcp.json`
- `$APPDATA/Claude/mcp.json` (Windows)
- `~/Library/Application Support/Claude/mcp.json` (macOS)

Marketplace / runtime-injected MCPs may not appear in static config files. Add them manually below the marker.

## Subagents at `.claude/agents/`

| File | Status |
|---|---|
| `constitution-service.md` | ✓ in registry (assumed loaded at session start) |
| `critic.md` | ✓ in registry (assumed loaded at session start) |
| `eac.md` | ✓ in registry (assumed loaded at session start) |
| `hr.md` | ✓ in registry (assumed loaded at session start) |
| `human-replica.md` | ✓ in registry (assumed loaded at session start) |
| `memory-keeper.md` | ✓ in registry (assumed loaded at session start) |

<!-- end-of-generated -->

## Manual additions

_(add marketplace MCPs / project-specific runtime details below)_
