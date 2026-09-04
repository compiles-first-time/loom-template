---
date: 2026-09-04
agent: stop-hook-autosuggest
severity: low
share: false
status: draft
signature: d8cfe947a9a97818
auto_suggested: true
auto_suggested_from_session: 009873e2-1389-5f6d-996b-b42c7cb46a50
auto_suggested_observation_count: 1
---

# Draft lesson — Bash failure (auto-suggested)

> **Auto-suggested by the Stop hook (PR-4 / E).** A human must (a) verify this is a real lesson, (b) fill in the sections below, (c) rename this file from `draft-2026-09-04-bash-shell-cwd-was-reset-to-home-user-loom-templat.md` to `2026-09-04-bash-shell-cwd-was-reset-to-home-user-loom-templat.md`, and (d) remove the `status: draft` and `auto_suggested` keys from the frontmatter. **Do not auto-promote.** Kernel Rule 22 requires human review of memory writes.
>
> **Builder note for the Director (2026-09-04):** sections filled in from the session that produced the signature. The verdict is left to you: this is a harness notice, not a tool failure, so it may be noise to discard. The signature file stays either way, so it will not be re-proposed.

## What happened

The tool `Bash` returned an error this session. First observed at 2026-09-04T07:31:47.633Z; last at 2026-09-04T07:31:47.633Z; observed 1 time(s).

Error preview (first ~240 chars, paths/timestamps redacted):

```

Shell cwd was reset to /home/user/loom-template
```

## Why it happened

The session ran a compound command that started with `cd /root/.claude/uploads/<session>/ && cat …` to read the three uploaded project files. Claude Code on the web keeps a persistent shell, and after a command that changes directory it resets the working directory to the project root and appends the notice `Shell cwd was reset to …` to the tool result. The notice carries a non-null error signature, so the Stop hook's auto-suggester classified it as a Bash failure. Nothing failed: the command's output was complete and correct.

## What we did

Nothing was needed. Every later command used absolute paths (or `cd` inside a `set -e` script whose effects end with the command), and the notice did not recur.

## What we'd do differently

- In Claude Code remote sessions, read files outside the project with absolute paths instead of `cd`; the harness resets the directory after the call and reports it as an error-shaped result.
- The Stop hook's failure classifier treats this harness notice as a tool error. If this pattern recurs across sessions, the fix belongs in Loom (`scripts/hooks/stop.mjs`: ignore results whose only error text is the cwd-reset notice). Per LR-08 that is filed as an Update Bus proposal from this project, never pushed to the template from here.

## Related

- Session ID: `009873e2-1389-5f6d-996b-b42c7cb46a50`
- Error signature: `d8cfe947a9a97818` (kept at `.signatures/d8cfe947a9a97818.txt`)
- Event log: see `memory/event-log/2026-09-04.jsonl` for the full `tool_result` records with this signature.
- ADR-0043 (project-root resolution and cwd drift) covers the neighbouring failure mode where hooks load against the wrong directory.
