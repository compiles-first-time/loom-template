---
date: 2026-08-08
agent: stop-hook-autosuggest
severity: medium
share: false
status: draft
signature: d8cfe947a9a97818
auto_suggested: true
auto_suggested_from_session: f8b18db0-96de-5105-9922-c364047c0c4b
auto_suggested_observation_count: 1
---

# Draft lesson — Bash failure (auto-suggested)

> **Auto-suggested by the Stop hook (PR-4 / E).** A human must (a) verify this is a real lesson, (b) fill in the sections below, (c) rename this file from `draft-2026-08-08-bash-shell-cwd-was-reset-to-home-user-loom-templat.md` to `2026-08-08-bash-shell-cwd-was-reset-to-home-user-loom-templat.md`, and (d) remove the `status: draft` and `auto_suggested` keys from the frontmatter. **Do not auto-promote.** Kernel Rule 22 requires human review of memory writes.

## What happened

The tool `Bash` returned an error this session. First observed at 2026-08-08T02:56:38.040Z; last at 2026-08-08T02:56:38.040Z; observed 1 time(s).

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

- Session ID: `f8b18db0-96de-5105-9922-c364047c0c4b`
- Error signature: `d8cfe947a9a97818` (kept at `.signatures/d8cfe947a9a97818.txt`)
- Event log: see `memory/event-log/2026-08-08.jsonl` for the full `tool_result` records with this signature.
