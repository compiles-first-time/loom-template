---
id: 2026-08-13-an-unchecked-convention-drifts
title: An unchecked convention drifts — three documented disciplines had silently stopped holding, and none of them announced it
domain: [governance, dx, observability]
stack: [loom, claude-code]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: loom-template (ADR-0059/0060/0061/0062 session, 2026-08-13)
  sources: [ADR-0059, ADR-0060, ADR-0061, ADR-0062, research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md, arXiv:2605.10039, arXiv:2605.12922]
  confidence: 0.95
created: 2026-08-13
updated: 2026-08-13
embedding_hash: null
agent_authored: true
---
# An unchecked convention drifts

## What happened

One session audited three of Loom's documented disciplines. **All three had silently stopped holding**, in different ways, and not one of them had produced a single warning:

1. **The intent nag was write-only.** `subagent_suggestion` events had been emitted on every user prompt since v0.2 (ADR-0017) and **nothing ever read them back.** Measured adherence over the preceding 14 days: **0%** — 4 suggestions, 0 acted on, 0 refused with a reason.
2. **Claim provenance was never validated.** The claim convention had always required `sources: [...]`. Nothing resolved a single one, so a hand-typed array was byte-identical to a verified one and Rule 22 was satisfiable by typing.
3. **The requirements-register format had degraded on first contact.** The skill specifies twelve fields; all nine registers use ten *different* ones. Five specified fields — including `Next Step` — appear in **zero** registers, which means two of the skill's own validator rules had never been runnable. Exceptions were attached to the requirement rather than the solution step in 8 of 9 registers, the exact error the skill spends a paragraph warning against. Exception density decayed from 4.3/step in the earliest register to **0.0 in BR_12** (four steps, zero enumerated failure modes).

A fourth instance surfaced while fixing the first: `stop.mjs` did `if (!existsSync(ledgerPath)) return;` against a **gitignored** progress ledger that nothing creates — so on any fresh clone the session log had never been written at all.

## Why it happened

Every one of these was **documented, correct, and unenforced.** The prose was not wrong; it simply had no consequences. The literature says this is structural rather than a matter of diligence:

- Instruction adherence decays **monotonically with turn count** — even strong reasoning models drop ~88% → ~71% by the third turn (`arXiv:2605.12922`).
- Adherence to **coding-agent configuration files specifically** — CLAUDE.md-shaped files — is unreliable and varies with file structure (`arXiv:2605.10039`).
- The cause is context dilution and sliding-window exclusion, not any instruction to forget.

Which yields the uncomfortable conclusion: **a governance rule written in CLAUDE.md is not a governance rule.** It is a hope with good formatting. This is the same finding ADR-0044 already reached for *output* verification ("prefer verification infrastructure over elaborate instructions"), now extended to *process*.

The decay is also not uniform — it is worst at the end. Register quality fell as the pattern became routine, exactly matching the turn-count decay curve. **The last thing you do is the least thorough thing you do**, which is precisely when nobody is still checking.

## What we'd do differently — the rule

**If a convention matters, a check must fail when it stops holding. If you are unwilling to write the check, you have decided the convention is optional — say so instead of documenting it.**

Operationally, for any new discipline:

1. **Name the observable.** What event, file, or field proves the discipline held? If nothing observable changes when it is violated, it cannot be a discipline.
2. **Write the checker before the prose.** ADR-0059/0060/0061 each ship a module plus a `loom doctor` check. The ADR documents the decision; the code enforces it.
3. **Make the checker deterministic and free.** No inference in a grader — a judge can be perfectly self-consistent and systematically wrong (`arXiv:2606.19544`), and a grader that costs money gets run rarely, which reintroduces the gap.
4. **Report the existing backlog honestly; do not grandfather it green.** All three checks fail on legacy data today. Suppressing that to get a clean board reproduces the exact pathology.
5. **Distinguish "could not check" from "checked and wrong."** Provenance resolution has three states, not two, because a blocked network is an environment fact and punishing it teaches people to stop citing.
6. **Leave the release valve.** Adherence counts an *owned refusal* as compliance (Rules 1/2/8). Mandating behaviour would narrow another agent's possibility space; requiring a **record** does not. The defect is silence, not disagreement.

## Corroboration that the method is right

The seeded-defect run built in the same session (ADR-0062) immediately found **three real evasion gaps** in the governance layer — `rm --recursive --force`, `find … -delete`, and `git push origin +main` — none of them obfuscation, all idiomatic usage, all previously waved through. Safety-catch delta went **+11 → +15** after closing them.

That is the general lesson in miniature: **the checks find things review does not.** Both prior substantive fixes to the register corpus came from an adversary (the Critic; the efficacy harness), never from re-reading the document. An exception list is not validated by reviewing it.
