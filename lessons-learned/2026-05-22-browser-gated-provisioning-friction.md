---
date: 2026-05-22
agent: ravenwise-session (synthesized from real use of Loom to spin up a first project)
severity: high
share: true
---

# Browser-gated provisioning fragments the architect's flow — and we over-classified actions as browser-only

## What happened

A new project (Ravenwise — a Google-OAuth-gated reading log) was bootstrapped from `loom-template` for the first time as a real architect-builder collaboration. The builder reached the deploy-prep stage and surfaced two unavoidable manual steps to the architect:

1. **Create a Supabase project** — the builder cited the v0.3.2 [MCP-vs-CLI capability matrix](../tools/mcp-cli-capability-matrix.md), which claimed `create-project` was browser-only.
2. **Create a Google Cloud OAuth 2.0 Client ID** — the builder treated this as browser-only by inheritance (no matrix row at the time).

The architect responded:

> "I do not want to have to do this. These specific pieces of information need to be updated in the Loom repo of GitHub and NOT with the Ravenwise code/repo."

Two distinct problems were surfaced by that single sentence:

1. **The Supabase claim was wrong.** Supabase ships a [Management API](https://supabase.com/docs/reference/api/introduction) with `POST /v1/projects` that creates projects programmatically given a Personal Access Token (PAT). The matrix row I authored in PR #27 was `[H]` confidence but the claim "no programmatic path" was incomplete — I checked dashboard docs and concluded no automation existed, when in fact a separate Management API exists at `api.supabase.com` distinct from the per-project APIs at `<ref>.supabase.co`.
2. **Even where browser-gating is genuine** (e.g., creating a standard-web-app OAuth Client in Google Cloud Console — there is no first-party API for this), the *fragmentation cost* on the architect's flow is real and not adequately surfaced as a Loom-level concern. The architect's working time gets diced by "go log into X, do Y, come back" round-trips. Each round-trip exits the loom-template's session, breaks the audit trail, and burns context.

## Why it happened

Two root causes, on different layers.

### Root cause 1 — matrix population was shallow

When I populated `tools/mcp-cli-capability-matrix.md` rows in PR #27, I checked **per-project / per-resource** docs (e.g., Supabase's CLI reference, which doesn't cover org-level project creation) and concluded "no programmatic path" without looking for **org-level / management** APIs at distinct domains. ADR-0033 §A invariant #1 ("at least one surface must be populated") was satisfied — `Human-browser: required` is a valid surface — but the `[H]` confidence marker was unwarranted for "no automated path" without checking the platform's management API surface.

### Root cause 2 — Loom doesn't yet have an opinion about minimizing browser-gated friction

The matrix tells you whether a given action is browser-gated. It does **not**:

- Suggest *credentials patterns* the architect should set up once (PATs, OAuth-installed-app tokens) that let the builder automate subsequent operations
- Identify *one-time vs. recurring* browser steps — creating an OAuth Client is one-time; creating projects is potentially recurring per Loom user; creating individual records is per-feature
- Provide a *bootstrap-time provisioning helper* that walks the architect through the one-time setup of PATs and stores them in `.env.local` so subsequent Loom sessions are friction-free
- Recommend a *provisioning specialist* analogous to `deploy` or `oauth` whose purpose is "drive management APIs to provision resources idempotently"

The matrix is necessary but not sufficient. The architect's complaint is precisely that the *gap* between "matrix tells you what's automatable" and "Loom actually automates it" is too wide.

## What we did

In this PR:

1. **Corrected the Supabase `create-project` row** in [`tools/mcp-cli-capability-matrix.md`](../tools/mcp-cli-capability-matrix.md) to reflect the Management API + PAT path. Confidence downgraded `[H] → [M]` for the create row because I haven't personally end-to-end verified the API works against a fresh org — that verification is a follow-up.
2. **Added new rows** for Google Cloud OAuth client management (`oauth-client-create`, `oauth-client-list`, `oauth-consent-screen-config`) so the next session doesn't repeat the inheritance mistake.
3. **Added a "One-time browser-gated setup" section** to the matrix's header explaining the credentials-bootstrap pattern (PAT, service account, OAuth installed-app token) so the matrix is a *tool* for friction reduction rather than just a passive inventory.
4. Captured the lesson here.

Out of scope for this PR but flagged for the next architect-builder cycle:

- **A `provisioning` specialist** (analogous to `deploy`) whose SKILL.md drives the platform-management APIs Loom now knows exist (Supabase, Vercel, Render, GitHub, Cloudflare, fly, etc.). The specialist would consult the matrix, find management-API rows, and provision resources end-to-end after the architect has set up the relevant PATs once.
- **A bootstrap-time provisioning-PAT collection step** in `scripts/bootstrap.{sh,ps1}` — interactive prompt: "Do you want to enable programmatic provisioning of {Supabase, Vercel, ...}? Paste a PAT for each platform; we'll store under `.env.local`." Honors LR-03 (paste-in-shell, not chat). This would close the loop on "I don't want to do this manually."
- **A matrix maintenance discipline doctor check** — when a `[H]` confidence "no automated path" row is added, doctor surfaces a soft warning to verify against the platform's management API documentation before committing.

## What we'd do differently

When populating the MCP-vs-CLI capability matrix from now on, the discipline:

1. **Check both per-resource and management API surfaces.** A platform's CLI rarely covers org-level operations; the Management API often does. Search the docs site for "Management API" and "PAT" before claiming "no programmatic path."
2. **Confidence markers reflect investigation depth.** A row with `[H]` "no automated path" must cite the management-API doc that confirms the gap, not just the CLI doc that doesn't cover it. Default to `[M]` until verified end-to-end against a real account.
3. **Distinguish *one-time* from *recurring* browser-gating** in the Notes column. "One-time PAT setup; then automatable" is a different friction class than "every operation requires browser confirmation."
4. **Loom's job is friction reduction, not friction documentation.** If a browser-gated row is for an operation the architect will hit repeatedly (creating projects, rotating credentials, adding redirect URIs), the matrix row is a signal that we should ship a `provisioning` specialist + helper, not that we should resign to manual work.

When using the matrix in real builder work, the heuristic:

- See a `Human-browser: required` row → **don't surface to the architect immediately**. First check: is there a management API the matrix missed? Is there a one-time-setup pattern that converts this from recurring-manual to one-time-manual? Surface the friction only after that check.
- If the operation is genuinely one-time-per-account (Google OAuth Client creation), bundle ALL one-time setup into a single architect handoff at session start, not one-step-at-a-time mid-session.

## Related

- [ADR-0033 — MCP-vs-CLI capability matrix](../adr/0033-mcp-vs-cli-capability-matrix.md) (this lesson amends §C "Maintenance policy" implicitly; a follow-up PR may codify the management-API discipline)
- [`tools/mcp-cli-capability-matrix.md`](../tools/mcp-cli-capability-matrix.md) (rows corrected in this PR)
- [ADR-0032 §B — pre-flight quota check](../adr/0032-deployment-hardening.md) (still applies; a programmatic project create still needs the pre-flight)
- Ravenwise session, 2026-05-22 (architect-builder dialog)
- Supabase Management API docs: https://supabase.com/docs/reference/api/introduction (the surface the original matrix entry missed)
