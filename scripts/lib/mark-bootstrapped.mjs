#!/usr/bin/env node
// Emit the `bootstrapped_this_session` marker from a bootstrap SCRIPT run
// (lesson 2026-07-10-first-governed-session-cold-start, recommendation #2).
//
// Why this exists separately from the session-start hook: in the TRUE cold-start
// (Loom copied into a new dir + bootstrapped mid-session), the session started
// before `.claude/` existed, so the SessionStart hook never fires — and once
// bootstrap stamps the placeholders, `findPlaceholders()` returns [] on every
// later session, so the hook-side marker never fires for this scenario at all.
// The bootstrap script runs in the shell regardless of hook registration, so
// calling this makes the marker PERSISTED + Observatory-visible (not just an
// ephemeral stdout banner) for exactly the scenario that motivated the lesson.
//
// Usage (from bootstrap.{sh,ps1}):  node scripts/lib/mark-bootstrapped.mjs [projectName]

import {
  appendEvent,
  mechanicalRecord,
  bootstrappedThisSessionPayload,
  deriveProjectName,
} from "../hooks/_lib.mjs";

const project = process.argv[2] || deriveProjectName();

appendEvent(
  mechanicalRecord(
    "bootstrapped_this_session",
    bootstrappedThisSessionPayload({
      session_id: process.env.CLAUDE_SESSION_ID || `bootstrap-${project}`,
      project,
      stamped: true, // the bootstrap script only reaches this after stamping
      source: "bootstrap-script",
    })
  )
);

process.stderr.write(`[loom] bootstrapped_this_session marker written for "${project}"\n`);
