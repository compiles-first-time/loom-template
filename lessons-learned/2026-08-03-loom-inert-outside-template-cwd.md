---
id: 2026-08-03-loom-inert-outside-template-cwd
title: Loom is silently inert when the session's working directory is not the template folder
domain: [governance, dx, onboarding]
stack: [loom, claude-code]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: loom-template (reported from a work-machine deployment, 2026-08-03)
  sources: [operator field report]
  confidence: 0.9
created: 2026-08-03
updated: 2026-08-03
embedding_hash: null
---
# Loom is silently inert when the session's working directory is not the template folder

## What happened

An operator ran Claude Code from a parent folder (`Admin Tasks/`) that *contains* a loom-template clone. Nothing errored — but none of Loom's governance applied: all 5 hooks and 19 subagents live in `loom-template/.claude/`, and Claude Code only loads that when the session's working directory **is** the template folder. Every safeguard (event log, destructive-op guard, constitution routing, subagents) was silently absent for the whole session.

## Why it happened

Claude Code resolves `.claude/` from the working directory. Loom's enforcement is entirely `.claude/`-carried, so "near the folder" ≡ "ungoverned," with no error and no signal. This is the worst failure shape for a governance system: **silent non-application** (the inverse of ADR-0038's hook-capture gap, which at least has a detector — but that detector also lives in the hooks that never ran).

## What we did

Captured the failure mode here with the operator's remediation: `cd` into the template folder (or the project folder built from it) and restart Claude Code — `cd <path>/loom-template && claude`. No in-repo mechanism can detect this case from inside Loom, because nothing of Loom executes.

## What we'd do differently

- Onboarding docs and any "use Loom at work" instructions must lead with: **open the session ON the Loom folder**, not a parent.
- A session that *believes* it is Loom-governed can cheaply self-check: does today's `memory/event-log/*.jsonl` contain this session's `session_start`? (The CLAUDE.md pre-PR checklist already requires this — apply it at session start, not just pre-PR.)
- Candidate future guard (out of scope here): a repo-root marker script an operator can run from anywhere (`node loom-template/scripts/lib/doctor.mjs`) prints a loud "governance active only when cwd = this folder" banner. The honest fix is documentation + habit; no code path exists to intercept a session that never touches the repo.
