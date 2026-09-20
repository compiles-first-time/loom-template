---
date: 2026-09-20
agent: stop-hook-autosuggest
severity: medium
share: false
status: draft
signature: d8cfe947a9a97818
auto_suggested: true
auto_suggested_from_session: cdb61ec7-5f6f-5c4b-ac2b-511b3dedf29e
auto_suggested_observation_count: 4
---

# Draft lesson — Bash failure (auto-suggested)

> **Auto-suggested by the Stop hook (PR-4 / E).** A human must (a) verify this is a real lesson, (b) fill in the sections below, (c) rename this file from `draft-2026-09-20-bash-shell-cwd-was-reset-to-home-user-loom-templat.md` to `2026-09-20-bash-shell-cwd-was-reset-to-home-user-loom-templat.md`, and (d) remove the `status: draft` and `auto_suggested` keys from the frontmatter. **Do not auto-promote.** Kernel Rule 22 requires human review of memory writes.

## What happened

The tool `Bash` returned an error this session. First observed at 2026-09-20T20:42:44.657Z; last at 2026-09-20T20:47:19.552Z; observed 4 time(s).

Error preview (first ~240 chars, paths/timestamps redacted):

```

Shell cwd was reset to /home/user/loom-template
```

## Why it happened

*(fill in — what was the root cause?)*

## What we did

*(fill in — workaround, fix, or escalation)*

## What we'd do differently

*(fill in — the heuristic future agents should apply)*

## Related

- Session ID: `cdb61ec7-5f6f-5c4b-ac2b-511b3dedf29e`
- Error signature: `d8cfe947a9a97818` (kept at `.signatures/d8cfe947a9a97818.txt`)
- Event log: see `memory/event-log/2026-09-20.jsonl` for the full `tool_result` records with this signature.
