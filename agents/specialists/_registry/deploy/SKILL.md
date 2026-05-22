---
name: deploy
summary: Deployment to common runtimes — Vercel, Netlify, Fly.io, Render. Configures `tools/runtime.yaml`, wires CI, verifies post-deploy health.
tier: bundled
context_budget: 16000
tools: [Read, Glob, Grep, Edit, Write]
---

# deploy specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md). Complements the Loom deploy primitive at `scripts/deploy.{sh,ps1}` (ADR-0019).

## Role + scope

Configures runtime-specific deployment for a project: writes `tools/runtime.yaml`, sets up domain mapping, wires environment variables, configures CI deploy hooks, verifies post-deploy health checks. Does NOT replace `scripts/deploy.sh` — it *configures* that wrapper.

When to invoke: prompts mentioning specific runtimes (Vercel, Netlify, Fly, Render, Railway, Cloudflare Pages) or "configure deployment", "domain mapping", "environment variables".

## Tool scope

- Read / Glob / Grep across whole repo.
- Edit / Write scoped to `tools/runtime.yaml`, `.env.example`, CI config (`.github/workflows/`, `vercel.json`, `netlify.toml`, `fly.toml`).
- Never write secret values; reference env vars by name (LR-03).

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEPLOY-EX-01 | SE | Configure | Runtime CLI not installed (`vercel`, `fly`, etc.) | Local PATH | Shell probe | Working CLI | Missing-binary error | Process | System.Exception | Print install command for the user; do not auto-install | Auto-installing third-party CLIs is invasive; the user should consent to which version + auth state they pick up |
| DEPLOY-EX-02 | BE | Configure | `post_deploy_url_pattern` produced by config doesn't match the runtime's actual stdout shape | Runtime docs | Test deploy | Regex against stdout | URL captured by `scripts/deploy.mjs` | String | Maybe-null URL | Fall back to "deployment succeeded; URL not captured" rather than failing; record the actual stdout sample to lessons-learned for next time | The regex is best-effort. Reporting "success without URL" beats failing a working deploy on a parser miss |
| DEPLOY-EX-03 | SE | Verify | Post-deploy health check returns 5xx (deploy succeeded but app crashes on boot) | Deployed URL | HTTP probe | GET / | `deploy.health_check_failed` event | HTTP | HTTP status | Emit `deployment_failed_health_check` event; surface the response body excerpt to the user; do NOT auto-rollback (user must decide) | Auto-rollback is per-runtime; doing it generically could mis-target. Surfacing the failure with diagnostic context lets the user (or `rollback` specialist in a future PR) decide |

## Decline triggers

- **Custom-built / on-prem deploy targets** → escalate to EAC; this specialist covers managed PaaS runtimes only.
- **Anything matching a `production_mutation_attempted` pattern without a constitution-service claim** → escalate per LR-02.

## Evidence basis

- **Primary:** Vendor docs (Vercel, Netlify, Fly, Render, Cloudflare Pages) for each runtime. `[vendor][H]` per runtime.
- **Corroborating:**
  - OWASP DevSecOps top 10 — supply-chain integrity in deploys. `[institutional][M]`
- **What would change this call:** a runtime's deploy mechanism becomes incompatible with the `tools/runtime.yaml` 5-field schema; would amend ADR-0019.

## Runtime counterpart

[`../../../../.claude/agents/deploy.md`](../../../../.claude/agents/deploy.md).
