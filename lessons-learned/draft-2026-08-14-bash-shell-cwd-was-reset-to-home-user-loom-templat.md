---
date: 2026-08-14
agent: stop-hook-autosuggest
severity: medium
share: false
status: draft
signature: d8cfe947a9a97818
auto_suggested: true
auto_suggested_from_session: 736219e4-dc88-50f6-b068-d1d28f93c84e
auto_suggested_observation_count: 4
---

# Draft lesson — Bash failure (auto-suggested)

> **Auto-suggested by the Stop hook (PR-4 / E).** A human must (a) verify this is a real lesson, (b) fill in the sections below, (c) rename this file from `draft-2026-08-14-bash-shell-cwd-was-reset-to-home-user-loom-templat.md` to `2026-08-14-bash-shell-cwd-was-reset-to-home-user-loom-templat.md`, and (d) remove the `status: draft` and `auto_suggested` keys from the frontmatter. **Do not auto-promote.** Kernel Rule 22 requires human review of memory writes.

## What happened

The tool `Bash` returned an error this session. First observed at 2026-08-14T08:36:33.040Z; last at 2026-08-14T08:37:31.493Z; observed 4 time(s).

Error preview (first ~240 chars, paths/timestamps redacted):

```

Shell cwd was reset to /home/user/loom-template
```

## Why it happened

**Assessment: this is a false positive, and the lesson to record is about the
detector, not about Bash.** Diagnosis added by the session agent that produced
the observations; left in `draft` status for human review per the header.

"Shell cwd was reset to /home/user/loom-template" is an *informational* harness
notice, not an error. The Bash tool keeps its working directory between calls,
but a `cd` issued inside a compound command does not persist; when a command
changes directory, the harness resets to the primary working directory and says
so. All four commands that triggered this succeeded — they were the ffmpeg
validation runs for `apps/studio` (generating test clips in `/tmp` and executing
a built assemble command), and their exit codes were 0.

The Stop hook's failure matcher appears to key on the presence of harness notice
text in the tool result rather than on a non-zero exit code, so an advisory
message was counted as four Bash failures.

## What we did

Nothing was worked around, because nothing was broken. The commands were written
as `cd /tmp && ...` per call, which is the correct pattern — the reset notice is
expected output for that pattern, not a symptom.

## What we'd do differently

Two candidate follow-ups for whoever reviews this:

1. **Fix the detector, not the caller.** The Stop hook's autosuggest should treat
   a Bash result as a failure only on a non-zero exit code, and should ignore
   known harness notices ("Shell cwd was reset to …") when deciding whether to
   open a draft. As written it will keep generating drafts for any session that
   uses `cd` inside a Bash call, which is common.
2. **Add the notice to a suppression list** if the exit-code check is not
   practical, so this specific signature stops recurring.

If the reviewer agrees this is purely a detector artifact, the right disposition
is to delete this draft and its signature file after making the hook change —
not to promote it.

## Related

- Session ID: `736219e4-dc88-50f6-b068-d1d28f93c84e`
- Error signature: `d8cfe947a9a97818` (kept at `.signatures/d8cfe947a9a97818.txt`)
- Event log: see `memory/event-log/2026-08-14.jsonl` for the full `tool_result` records with this signature.
