---
id: 2026-07-28-setup-docs-must-match-the-runtime-default
title: A setup doc that names a port must match what the launcher actually binds
domain: [auth, provisioning, dx]
stack: [loom, nextjs, oauth]
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
# A setup doc that names a port must match what the launcher actually binds

## What happened

IDEA's `.env.example` instructed the operator to register a GitHub OAuth app with:

```
Homepage URL:  http://localhost:3000
Callback URL:  http://localhost:3000/api/auth/callback/github
```

The launcher (`bin/idea.mjs`) binds **4300**. Following the setup file exactly
produces a `redirect_uri mismatch` on the very first sign-in.

Two things make this worse than an ordinary stale doc:

1. **The error arrives from the identity provider**, so it looks like a GitHub
   problem, or like the operator mistyped something in GitHub's UI. The
   misleading file is not in the frame.
2. **It fires at first-run**, before any working state exists to compare against.
   The operator has no "it worked yesterday" to reason from.

The same file also referenced a hosted-deployment callback that a later ADR had
removed, and named a chat model absent from the model registry.

## Why it happened

The port default and the setup instructions live in different files with no
mechanical relationship. `DEFAULT_PORT = 4300` was chosen in the launcher; the
example env file was written earlier against the framework's stock 3000 and was
never revisited. Nothing failed at build time, nothing failed at test time, and
nothing failed at runtime for anyone who already had a working config.

The general shape: **a constant duplicated between code and prose, where only the
prose copy is consumed by a human, and only at a moment when they cannot yet
verify anything.**

## What we'd do differently (recommendations for loom-template)

- **Derive the setup instructions from the constant, or test that they agree.**
  A test asserting that every URL in the setup doc contains the launcher's actual
  default port is a few lines and never goes stale silently. Provisioning
  playbooks that name ports, paths, or callback URLs deserve the same check.
- **Print the callback URL from the running process, not from a document.** The
  launcher already knows its port; when config is missing it should say
  `http://localhost:<actual-port>/api/auth/callback/github`. IDEA's launcher does
  this correctly — which is why the mismatch between the two was findable at all.
- **Treat first-run instructions as a higher tier than ordinary docs.** They are
  consumed exactly once by someone with zero working baseline, and the resulting
  error usually names a third party rather than the real culprit.
- **When auditing a setup file, check every constant against its source** — port,
  URL, model id, path. The stale ones cluster: this file had three.

## Related

- [`tools/provisioning-playbooks/`](../tools/provisioning-playbooks/) — same exposure wherever a playbook names a port or callback
- [`2026-05-22-browser-gated-provisioning-friction.md`](./2026-05-22-browser-gated-provisioning-friction.md) — adjacent: first-run setup steps a human must perform by hand
