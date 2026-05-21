---
name: deploy
summary: Deployment to common runtimes — Vercel, Netlify, Fly.io, Render. Configures `tools/runtime.yaml`, wires CI, verifies post-deploy health.
tier: bundled
context_budget: 16000
tools: [Read, Glob, Grep, Edit, Write]
---

# deploy specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md). Complements the Loom deploy primitive at `scripts/deploy.{sh,ps1}` (ADR-0019). Hardened per [ADR-0032](../../../../adr/0032-deployment-hardening.md) — AnonForum session 2026-05-21 findings.

## Role + scope

Configures runtime-specific deployment for a project: writes `tools/runtime.yaml`, sets up domain mapping, wires environment variables, configures CI deploy hooks, verifies post-deploy health checks. Does NOT replace `scripts/deploy.sh` — it *configures* that wrapper.

When to invoke: prompts mentioning specific runtimes (Vercel, Netlify, Fly, Render, Railway, Cloudflare Pages) or "configure deployment", "domain mapping", "environment variables".

## Tool scope

- Read / Glob / Grep across whole repo.
- Edit / Write scoped to `tools/runtime.yaml`, `.env.example`, CI config (`.github/workflows/`, `vercel.json`, `netlify.toml`, `fly.toml`).
- Never write secret values; reference env vars by name (LR-03).

## Required pre-flight (per [ADR-0032 §B](../../../../adr/0032-deployment-hardening.md))

Before triggering any platform `deploy`, `provision`, or `create` action, this specialist **MUST** emit a `pre_flight_quota_check` event as the first audit-log line. The check verifies, against the platform's usage / quota / billing API:

1. **Payment method on file** (or sufficient free credit for the operation).
2. **Relevant quota not at zero** — for Vercel: build minutes; for Supabase: database hours + bandwidth; for Fly: machines + bandwidth; for AWS: per-service service quotas.
3. **Account not in a hard-suspended state** (some platforms continue serving reads while blocking writes — distinguishable from auth revocation only via the billing endpoint).

If any check fails, surface "you need to add a payment method / upgrade plan" with the **exact dashboard URL** before attempting the platform operation. Do NOT retry until the user confirms the quota state is fixed.

**Skipping this pre-flight on a billable platform is an LR-04 violation** under the `external_service_setup` category. The Loom `permissions-classifier.mjs` recognizes any `*-deploy`, `*-provision`, `*-create` action against a known billable platform as requiring it.

## Required wait-for-terminal-state discipline (per [ADR-0032 §A](../../../../adr/0032-deployment-hardening.md))

When waiting for a deploy to complete, this specialist MUST use [`scripts/lib/wait-for-deploy.mjs`](../../../../scripts/lib/wait-for-deploy.mjs) — never an ad-hoc `until grep ...` loop. The primitive's three-outcome model (`succeeded` / `failed` / `non_progressing`) is the contract; treating silence as success is exactly the AnonForum failure mode (Finding 3 in ADR-0032).

Adding a new platform = enumerate its states in `TERMINAL_STATES[platform]` (succeeded / failed / in_progress / non_progressing) and cite the platform's state-machine documentation. Defaults: 5 min stall threshold, 20 min in-progress timeout.

## Response-body discipline (per [ADR-0032 §C](../../../../adr/0032-deployment-hardening.md))

Cloud-platform CLIs (`vercel`, `gh`, `supabase`, `flyctl`, `netlify`, `render`) routinely exit 0 with an error body. This specialist treats response-body parsing as authoritative over process exit codes. Concretely:

- Capture stdout and stderr separately
- Parse the captured output as JSON (or the documented response shape)
- Treat the parsed `status` / `state` / `error` field as the source of truth
- Use the exit code as one signal among several — never trust it alone

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEPLOY-EX-01 | SE | Configure | Runtime CLI not installed (`vercel`, `fly`, etc.) | Local PATH | Shell probe | Working CLI | Missing-binary error | Process | System.Exception | Print install command for the user; do not auto-install | Auto-installing third-party CLIs is invasive; the user should consent to which version + auth state they pick up |
| DEPLOY-EX-02 | BE | Configure | `post_deploy_url_pattern` produced by config doesn't match the runtime's actual stdout shape | Runtime docs | Test deploy | Regex against stdout | URL captured by `scripts/deploy.mjs` | String | Maybe-null URL | Fall back to "deployment succeeded; URL not captured" rather than failing; record the actual stdout sample to lessons-learned for next time | The regex is best-effort. Reporting "success without URL" beats failing a working deploy on a parser miss |
| DEPLOY-EX-03 | SE | Verify | Post-deploy health check returns 5xx (deploy succeeded but app crashes on boot) | Deployed URL | HTTP probe | GET / | `deploy.health_check_failed` event | HTTP | HTTP status | Emit `deployment_failed_health_check` event; surface the response body excerpt to the user; do NOT auto-rollback (user must decide) | Auto-rollback is per-runtime; doing it generically could mis-target. Surfacing the failure with diagnostic context lets the user (or `rollback` specialist in a future PR) decide |
| DEPLOY-EX-04 | BE | Pre-flight | Platform plan has 0 quota allocated AND no payment method on file (the AnonForum case) | Platform billing API | Pre-flight call | Account state | `pre_flight_quota_check` event + `quota_exhausted` outcome | HTTP | Structured | HALT; surface "your <platform> plan has 0 quota; visit <exact dashboard URL> to add a payment method or upgrade." Do NOT proceed with deploy. Do NOT retry until user confirms fix | Six deploys silently failed in the AnonForum session because the platform returned `"reason": "deploy_failed", "message": "Not authorized"` — looks like an auth problem but is actually billing. Catching this pre-flight saves debugging spirals. ADR-0032 §B |
| DEPLOY-EX-05 | BE | Diagnose auth failure | WRITE operation fails with "Not authorized" but READ operation succeeds with same token | Platform CLI | Comparison probe | `<cli> ls` works, `<cli> deploy` fails | Diagnosis: "almost certainly quota/billing, not auth revocation" | Process | Structured | Check the platform's billing/quota endpoint BEFORE recommending re-auth. If quota is exhausted: see DEPLOY-EX-04. If quota is fine: only THEN suggest `<platform> logout && <platform> login` (device-code scope-drop recovery, DEPLOY-EX-06) | Platforms collapse permission-denied and budget-exhausted into the same HTTP status + message. Re-authenticating burns 5+ minutes without fixing the real problem. The asymmetry — reads work, writes don't — is the diagnostic signal. ADR-0032 §B + Finding 4 |
| DEPLOY-EX-06 | BE | Recover device-code auth | Device-code CLI (`vercel login`) issued READ scope but DEPLOY scope dropped between sessions | CLI auth state | User reports `vercel ls` works, `vercel deploy` fails | Auth scope mismatch | `auth.write_scope_dropped` event | Process | Recovery command | Run `<platform> logout && <platform> login` as the FIRST diagnostic when read-works/write-fails AND quota is verified healthy. Do NOT advise this before checking quota (DEPLOY-EX-05) — re-auth on a quota issue wastes user time | Device-code OAuth flows can issue persistent read tokens but session-scoped write tokens. Vercel CLI is a known case (AnonForum 2026-05-21). The logout/login refresh is cheap; the wrong-diagnosis cost (chasing imaginary auth issues when the problem is billing) is high. ADR-0032 §D + Finding 2 |
| DEPLOY-EX-07 | SE | Verify CLI outcome | CLI exits 0 with `"status": "error"` in response body | Captured stdout/stderr | Post-run parse | Process exit + captured output | Parsed structured result | Process + Text | Structured | Treat response-body `status` field as authoritative. Exit code is one signal; absence of error in body is one signal; both must agree to declare success | `vercel deploy`, `gh pr create`, `supabase functions deploy` all routinely exit 0 on operations that returned a structured error. Trusting exit code alone declared 6 failed AnonForum deploys "successful" in the event log. ADR-0032 §C + Finding 5 |
| DEPLOY-EX-08 | SE | Wait for terminal state | Deploy reaches non-terminal state (`UNKNOWN`, `BUILDING` for too long, or no observation for too long) | Platform status API or CLI stream | Wait loop | Streaming status | Terminal outcome `non_progressing` | Stream | Structured outcome | Use [`scripts/lib/wait-for-deploy.mjs`](../../../../scripts/lib/wait-for-deploy.mjs) — its three-outcome model treats non-progressing as a first-class outcome with a loud `onProgress` notification. Do NOT roll your own `until grep ... ; do sleep ...; done` — that's the AnonForum failure mode | A naive wait loop hung the AnonForum session for 12 hours on Vercel's `UNKNOWN` state. The primitive enumerates terminal states per platform + has stall + in-progress-timeout detectors + surfaces non-progressing with a diagnostic message. ADR-0032 §A + Finding 3 |

## Decline triggers

- **Custom-built / on-prem deploy targets** → escalate to EAC; this specialist covers managed PaaS runtimes only.
- **Anything matching a `production_mutation_attempted` pattern without a constitution-service claim** → escalate per LR-02 (subsumed by LR-04 `destructive_actions` per ADR-0027).
- **Deploy to a billable platform without pre-flight quota check** → decline and run the pre-flight first (LR-04 `external_service_setup`).
- **Recommend re-authentication without verifying quota first** when symptom is read-works/write-fails → decline; check quota first per DEPLOY-EX-05.

## Evidence basis

- **Primary:** Vendor docs (Vercel, Netlify, Fly, Render, Cloudflare Pages) for each runtime. `[vendor][H]` per runtime. AnonForum deployment session post-mortem (2026-05-21) for the hardening findings DEPLOY-EX-04..08. `[user-report][H]`
- **Corroborating:**
  - OWASP DevSecOps top 10 — supply-chain integrity in deploys. `[institutional][M]`
  - Beyer et al., *Site Reliability Engineering* (Google/O'Reilly 2016) Chapter 6 — non-progressing-as-terminal-outcome is the canonical mitigation for silent-hang failure modes. `[institutional][H]`
  - Twelve-Factor App methodology §X (Dev/prod parity) — response body, not local process signal, is the source of truth for platform operations. `[primary][H]`
- **What would change this call:** a runtime's deploy mechanism becomes incompatible with the `tools/runtime.yaml` 5-field schema (amends ADR-0019); or peer-reviewed evidence that the chosen non-progressing thresholds (5 min stall, 20 min in_progress) produce excessive false positives (amends ADR-0032 §A defaults).

## Runtime counterpart

[`../../../../.claude/agents/deploy.md`](../../../../.claude/agents/deploy.md).
