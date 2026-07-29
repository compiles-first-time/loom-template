---
id: 2026-07-28-a-refusal-must-name-what-it-refused
title: Fail closed, but never fail silent — a refusal must name what it refused
domain: [auth, observability, dx]
stack: [loom, nextjs, authjs]
platform: [win32, linux, darwin]
severity: medium
share: true
supersedes: null
provenance:
  origin_project: IDEA
  sources: [IDEA]
  confidence: 0.9
created: 2026-07-28
updated: 2026-07-28
embedding_hash: null
---
# Fail closed, but never fail silent — a refusal must name what it refused

## What happened

IDEA gates sign-in on an allowlist of GitHub logins and fails closed: not on the
list, not in. Correct. But the refusal produced only `AccessDenied` — in the
browser *and* in the server log.

The operator (the repo owner, on their own machine) could not get in and had no
way to find out why. The allowlist held `compiles-first-time`. Their browser was
authenticated as `compiles-first-try` — a **second account, one character
different**, because GitHub sign-in had been completed through a Google IAM
identity while the command line used the other account.

Debugging by guesswork consumed several exchanges. The fix was one line of
configuration.

Then the near-identical failure repeated: the operator added the second account
by hand and typed `compiles=first-try` — an `=` where the `-` belonged. A
comma-separated env list silently does not match a malformed entry, so the
outcome was byte-identical to the previous failure: `AccessDenied`, no detail.

## Why it happened

Fail-closed was conflated with fail-silent. They are unrelated:

- **Fail closed** is about *what the system permits*. Non-negotiable at a
  security boundary.
- **Silence** is about *what the system says afterwards*. It buys nothing here.

A GitHub username is public. The server log is local. Nothing was protected by
withholding it — the only party denied information was the person trying to fix
their own machine.

The general shape: a gate that compares an *observed* value against a
*configured* one, and on mismatch reports neither. The operator can see the
configured value (they wrote it) but **not the observed one**, which is exactly
the half they need.

## What we did

Named the refused login and printed the current allowlist, to the server log
only:

```
[auth] sign-in refused: "compiles-first-try" is not in ALLOWED_LOGINS
       (compiles-first-time). If that is your account, add it; if it is not,
       sign out of GitHub and sign in as an allow-listed account.
```

It identified the cause on the first attempt after the change. The second failure
(the typo) was then visible immediately — the log showed the account correctly
and the allowlist obviously malformed.

The check moved into a pure, tested function; the auth wiring holds no logic.

## What we'd do differently (recommendations for loom-template)

- **Every gate that compares observed against configured must log both.** This
  covers permission classification, allowlists, tool gating, and model routing —
  anywhere `loom-permissions.yaml` or a config list says no.
- **Ask "is this value actually secret?" before withholding it.** Usernames,
  tool names, rule ids, and matched patterns are not. Tokens and keys are.
  Withholding non-secrets to look secure costs real debugging hours.
- **Distinguish the three refusal causes in the message**, because the fixes are
  different: value not in list · list empty (fail-closed default) · value absent
  or malformed.
- **A config list that fails to match should be checked for malformation**, not
  just non-membership. `compiles=first-try` in a comma-separated list is a typo,
  not a policy decision, and the two are worth distinguishing to the reader.

## Related

- [`.claude/loom-permissions.yaml`](../.claude/loom-permissions.yaml) — same pattern: a classifier that refuses should say which rule matched
- [ADR-0053](../adr/0053-agent-reputation-and-dispatch.md) — guardrail A, transparency: a record that affects an actor must be visible to that actor
