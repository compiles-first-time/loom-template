# EMBER changelog

One line per task, newest last (spec §7.1: every role may append here; CLAUDE.md session ritual: read the tail at start, add a line at the end). Format: `YYYY-MM-DD · role · what changed · where to look`.

- 2026-09-04 · orchestrator · Cloned Loom into EMBER: GAME_INFRA_SPEC.md added verbatim, CLAUDE.md/AGENTS.md rewritten as EMBER adapters, LR-08 upstream isolation, systems atlas (745 systems, 1,131 edges, validator, ATLAS.md, explorer.html), ADR-0065 proposed · PR #102 on the seed branch
- 2026-09-04 · orchestrator · Kept the Stop hook's draft lesson on the cwd-reset notice for Director review · `lessons-learned/draft-2026-09-04-*`
- 2026-09-05 · orchestrator · Registry audit applied and the atlas made agent-ready (ADR-0066): 17 change runbooks validated against the registry, `which` / `checklist` / `audit-diff`, a registry mutation API that reverts invalid writes, the `systems/llm/` machine pack, and a PreToolUse guard that names the system at edit time and denies hand edits of generated files. Registry surgery: 29 duplicate or padding nodes merged, 8 systems added, ~100 couplings added or re-pointed, 7 proposed signals re-statused `implied`, raids and enemy abilities → `candidate`, Where and owner precision → 715 systems, 1,171 edges, 4 open console findings · `systems/`, `scripts/lib/systems-*.mjs`, `scripts/hooks/pre-tool-use.mjs`
