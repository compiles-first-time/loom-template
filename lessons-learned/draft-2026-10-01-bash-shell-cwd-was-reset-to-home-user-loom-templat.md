---
date: 2026-10-01
agent: stop-hook-autosuggest
severity: medium
share: false
status: draft
signature: d8cfe947a9a97818
auto_suggested: true
auto_suggested_from_session: f76a349a-fd2d-55df-9d8a-29e83d105d30
auto_suggested_observation_count: 126
---

# Draft lesson — Bash failure (auto-suggested)

> **Auto-suggested by the Stop hook (PR-4 / E).** A human must (a) verify this is a real lesson, (b) fill in the sections below, (c) rename this file from `draft-2026-10-01-bash-shell-cwd-was-reset-to-home-user-loom-templat.md` to `2026-10-01-bash-shell-cwd-was-reset-to-home-user-loom-templat.md`, and (d) remove the `status: draft` and `auto_suggested` keys from the frontmatter. **Do not auto-promote.** Kernel Rule 22 requires human review of memory writes.

## What happened

The tool `Bash` returned an error this session. First observed at 2026-10-01T21:43:46.648Z; last at 2026-10-01T23:11:42.236Z; observed 126 time(s).

Error preview (first ~240 chars, paths/timestamps redacted):

```

Shell cwd was reset to /home/user/loom-template
```

## Why it happened

**False positive — no command failed.** `scripts/hooks/post-tool-use.mjs` (lines ~33–42) records `errorText` from
`tool_response.stderr` whenever stderr is non-empty, *regardless of exit code*. The Claude Code cloud
harness writes an informational notice ("Shell cwd was reset to …") to stderr after commands that `cd`
elsewhere. Every successful command therefore got an `error_signature`, and `stop-lessons.mjs` counted
126 "failures" of one signature and drafted this lesson. `[post-tool-use.mjs read 2026-10-01][>95%]`

## What we did

Nothing was broken in the session's work (all commands exited 0). Recorded the root cause here and proposed a
separate one-line fix: only treat stderr as error text when `exitCode` is non-zero or `is_error` is true.

## What we'd do differently

Classify a tool result as a failure from its **exit status**, never from the mere presence of stderr — many
tools (git, npm, harnesses) write progress and notices to stderr on success. A failure detector that
ignores the exit code drifts into noise and buries real failures (an unchecked convention drifts).

## Related

- Session ID: `f76a349a-fd2d-55df-9d8a-29e83d105d30`
- Error signature: `d8cfe947a9a97818` (kept at `.signatures/d8cfe947a9a97818.txt`)
- Event log: see `memory/event-log/2026-10-01.jsonl` for the full `tool_result` records with this signature.
