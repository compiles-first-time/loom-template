---
id: 2026-08-03-crlf-byte-compare-phantom-drift
title: Byte-comparing a generated file against a git checkout reports phantom drift on Windows (core.autocrlf)
domain: [dx, observability, tooling]
stack: [loom, node, git]
platform: [win32]
severity: medium
share: true
supersedes: null
provenance:
  origin_project: loom-template (reported from a work-machine deployment, 2026-08-03)
  sources: [operator field report, scripts/lib/mcp-yaml-to-settings.mjs]
  confidence: 0.95
created: 2026-08-03
updated: 2026-08-03
embedding_hash: null
---
# Byte-comparing a generated file against a git checkout reports phantom drift on Windows

## What happened

On a fresh Windows clone of loom-template (a work machine, first-ever run), `loom doctor` **hard-failed** its `mcp-yaml-json-alignment` check with "drift" — yet regenerating produced an **empty git diff**. Nothing had drifted.

## Why it happened

The check (`scripts/lib/mcp-yaml-to-settings.mjs --check`) compared the on-disk `.claude/settings.json` **byte-for-byte** against a freshly generated string that is always LF. With `core.autocrlf true` (the git-for-Windows default), a fresh clone checks the file out as **CRLF** — so the byte compare fails on every fresh Windows clone even when content is identical. Long-lived clones can mask the bug when the file happens to sit at LF locally, which is why the template's own dev machine never saw it.

## What we did

`--check` (and the no-op detection on apply) now compare through `normalizeEol()` (CRLF→LF) — content equality, not byte equality. Real content drift still fails through any line-ending. Regression-tested in `scripts/lib/mcp-yaml-to-settings.test.mjs`.

## What we'd do differently

Any check that byte-compares a **git-checked-out file** against a **generated string** must normalize line endings first (or the repo must pin the file's EOL via `.gitattributes`). Grep for `=== expected`-style comparisons whenever adding a doctor check that reads tracked files. A repo-wide `.gitattributes` EOL policy is the deeper fix but renormalizes history-adjacent churn — deferred; the comparison-side fix is sufficient and local.
