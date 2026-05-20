# Handoff documents

> Dated context-migration artifacts for new Claude Code sessions on the Loom template project.

Each file in this directory is a **frozen snapshot** capturing project state + collaboration nuances at the time of writing. A new Claude instance (or a Nick coming back after a break) reads the most recent one to understand what's been decided, what's in flight, and how the work is structured.

## Why this directory exists

The Loom template is a multi-session project. Across 30+ commits and 20 PRs, we've established conventions and made decisions whose *rationale* doesn't always survive a context-window reset. The handoff documents are explicit, verbose, and capture both what's true and the why behind it.

## Convention

- **Date-prefixed filenames:** `YYYY-MM-DD-<short-description>.md`
- **Never edit existing docs.** They're snapshots. If something becomes wrong, write a new one that supersedes.
- **CLAUDE.md points at the latest.** When you add a new handoff, update the CLAUDE.md link.
- **Keep the history.** Old handoff docs preserve what we knew when we knew it — useful for future "wait why did we decide that?" questions.

## How to use these documents

### If you are a fresh Claude Code instance

1. Read [`../CLAUDE.md`](../CLAUDE.md) for the project index.
2. Read the **most recent** handoff doc in this directory (sorted by filename).
3. Follow the read order it suggests.
4. **Don't generate output beyond reading + a status summary** until you've finished step 2.

### If you are Nick

- Review when adding new handoff docs to make sure I've captured what matters.
- Update "What's likely next" if priorities shift.

### If you are someone else

- The TL;DR section in each handoff doc is paste-able into a new Claude chat.
- The Critical decisions and idioms section is the most load-bearing.

## Index

| Date | File | Phase covered | Notes |
|---|---|---|---|
| 2026-05-20 | [`2026-05-20-loom-v1.0-context.md`](./2026-05-20-loom-v1.0-context.md) | batch-01 → v1.0 | Comprehensive — 30 ADRs, 5 LRs, 8 layers, 18 subagents, 18 open PRs. First handoff doc in the project. |
