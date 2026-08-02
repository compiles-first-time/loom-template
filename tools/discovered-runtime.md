# Discovered runtime

> **Auto-generated** by `scripts/discover-runtime.{sh,ps1}` at SessionStart and at bootstrap. Per [ADR-0020](../adr/0020-runtime-discovery.md).

> Manual additions: write below the `<!-- end-of-generated -->` marker. The auto-generated section above will be overwritten on next run; your manual section will be preserved.

Generated: 2026-08-02T19:42:14.606Z

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
| `auth.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `ci.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `constitution-service.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `credential-setup.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `critic.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `db-migration.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `deploy.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `eac.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `email.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `error-tracking.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `file-storage.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `hr.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `human-replica.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `memory-keeper.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `monitoring.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `oauth.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `payments.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `queues.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |
| `secrets.md` | **STALE** — newer than discovery sentinel; not invokable until Claude Code restart |

**Action:** Restart Claude Code so the Agent tool can see the newer subagent files. After restarting and confirming the agents work (try `Agent(subagent_type="critic", ...)`), run:

```bash
touch .claude/agents/.last-discovered-at
```

to update the sentinel and suppress this nag.

<!-- end-of-generated -->

## Manual additions



_(add marketplace MCPs / project-specific runtime details below)_
