# MCP-vs-CLI capability matrix

> Per [ADR-0033](../adr/0033-mcp-vs-cli-capability-matrix.md). Authoritative reference for specialists choosing between MCP server and CLI tool surfaces for a given `(platform, action)` tuple.

This is a **living document**. Rows are added when a specialist hits an unmapped `(platform, action)` during real work; updated when a vendor ships, removes, or changes MCP coverage. Per-row staleness threshold is 90 days from last verification (Loom doctor flags stale rows as soft warning in a follow-up PR).

## How to read a row

- **Platform**: lowercase platform key; matches `TERMINAL_STATES` keys in [`../scripts/lib/wait-for-deploy.mjs`](../scripts/lib/wait-for-deploy.mjs) where applicable.
- **Action**: concrete verb. Same `(platform, action)` may appear as multiple rows if behavior differs by sub-action (e.g., `deploy` vs `deploy --prod`).
- **MCP server**: identifier of the form `mcp__<server>__<tool>` if a working MCP tool exists; `—` if not.
- **CLI**: the binary + minimal args if a CLI path exists; `—` if not.
- **Human-browser**: `required` / `optional` / `—`. `required` is a hard handoff to the user — the specialist must stop and route to the human.
- **Confidence**: `[H]` (verified end-to-end), `[M]` (verified surface exists, end-to-end not personally tested), `[L]` (claim from vendor docs only, no real-session evidence).
- **Source**: citation for verification. Vendor docs preferred; MCP repo READMEs second.
- **Notes**: quirks. Specifically called out when an MCP delegates back to a CLI (picking the MCP gives no credential-hygiene benefit and adds latency).

## How to use the matrix in a specialist

1. **Look up** the `(platform, action)` pair before choosing a tool.
2. **Capability first**: prefer the surface that completes the action end-to-end. If only one does, pick that.
3. **Credential hygiene** (per [L4 MCP-over-CLI](../layers/L4-tooling.md#mcp-over-cli-for-credentialed-services)): when both surfaces are capable, prefer the MCP server (credential stays out of tool args).
4. **Cost** (per [ADR-0032 §B](../adr/0032-deployment-hardening.md)): a billable action's `pre_flight_quota_check` event still fires regardless of surface; the matrix doesn't change that.
5. **If absent**: note the gap in the specialist's return; default to credential-hygiene preference; propose a matrix row in a follow-up PR.

---

## Vercel

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| deploy | `mcp__vercel__deploy_to_vercel` | `vercel deploy [--prod]` | — | [M] | Vercel MCP source repo; [Vercel CLI docs](https://vercel.com/docs/cli) | **MCP delegates back to CLI in some implementations** — verify before picking; if MCP delegates, credential-hygiene benefit is lost (AnonForum 2026-05-21 finding) |
| inspect | `mcp__vercel__get_deployment` | `vercel inspect <url-or-id>` | — | [H] | [Vercel API](https://vercel.com/docs/rest-api/endpoints/deployments) | MCP path returns full JSON; CLI text by default + `--json` flag |
| list-deployments | `mcp__vercel__list_deployments` | `vercel ls` | — | [H] | [Vercel API](https://vercel.com/docs/rest-api/endpoints/deployments) | Either works; MCP preferred for credential hygiene |
| set-env | — | `vercel env add <NAME> <env>` | optional | [H] | [Vercel CLI env](https://vercel.com/docs/cli/env) | CLI is interactive (prompts for value); no MCP coverage observed |
| add-domain | — | `vercel domains add <domain>` | required for DNS verification | [H] | [Vercel domains](https://vercel.com/docs/projects/domains) | DNS records added at registrar — browser step is on the user's DNS provider, not Vercel |
| check-billing | — | — | required | [H] | [Vercel billing dashboard](https://vercel.com/dashboard/usage) | Dashboard-only; no CLI / MCP for billing portal access |
| login (auth) | — | `vercel login` | required | [H] | [Vercel CLI login](https://vercel.com/docs/cli/login) | Device-code OAuth flow; browser confirmation step is the device-code dance (DEPLOY-EX-06) |

## Netlify

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| deploy | — | `netlify deploy [--prod]` | — | [H] | [Netlify CLI](https://docs.netlify.com/cli/get-started/) | No first-party MCP at time of writing; CLI is the only path |
| status | — | `netlify status` | — | [H] | [Netlify CLI](https://docs.netlify.com/cli/get-started/) | — |
| set-env | — | `netlify env:set NAME value` | optional | [H] | [Netlify env vars](https://docs.netlify.com/configure-builds/environment-variables/) | — |
| add-domain | — | `netlify domains:add <domain>` | required for DNS | [H] | [Netlify domains](https://docs.netlify.com/domains/) | DNS step on user's registrar |
| check-billing | — | — | required | [H] | [Netlify billing dashboard](https://app.netlify.com/billing) | Dashboard-only |

## Fly.io

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| deploy | — | `fly deploy` | — | [H] | [Fly.io deploy](https://fly.io/docs/launch/deploy/) | No first-party MCP observed |
| status | — | `fly status` | — | [H] | [Fly.io status](https://fly.io/docs/flyctl/status/) | — |
| set-secret | — | `fly secrets set NAME=value` | — | [H] | [Fly.io secrets](https://fly.io/docs/reference/secrets/) | Writes are **staged**, applied on next deploy — surprise category for first-time users |
| create-app | — | `fly apps create <name>` | — | [H] | [Fly.io apps](https://fly.io/docs/flyctl/apps-create/) | Billable: triggers ADR-0032 §B pre-flight quota check |
| check-billing | — | `fly orgs show <org> --json` | optional | [H] | [flyctl orgs](https://fly.io/docs/flyctl/orgs-show/) | CLI returns billing fields in JSON; full dashboard for plan changes |

## Render

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| deploy | — | `render deploys create --service <id>` | — | [H] | [Render CLI](https://render.com/docs/cli) | — |
| list-deploys | — | `render deploys list --service <id>` | — | [H] | [Render CLI](https://render.com/docs/cli) | — |
| create-service | — | `render services create` | optional | [M] | [Render services](https://render.com/docs/blueprint-spec) | Blueprint-driven YAML preferred; CLI for ad-hoc |
| check-billing | — | — | required | [H] | [Render billing dashboard](https://dashboard.render.com/billing) | Dashboard-only |

## Supabase

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| query (SELECT) | `mcp__supabase__execute_sql` | `supabase db query` | — | [H] | Supabase MCP repo; [supabase CLI](https://supabase.com/docs/reference/cli) | MCP strongly preferred for credential hygiene |
| migrate | `mcp__supabase__apply_migration` | `supabase db push` | — | [H] | Supabase MCP repo | MCP and CLI both work; MCP preferred |
| create-project | — | — | required | [H] | [Supabase dashboard](https://supabase.com/dashboard/projects) | No automated path — billing + region selection required in browser. Pre-flight quota per ADR-0032 §B does NOT apply (no programmatic creation) |
| deploy-edge-function | `mcp__supabase__deploy_edge_function` | `supabase functions deploy <name>` | — | [H] | Supabase MCP repo | Both work; MCP preferred |
| set-secret | — | `supabase secrets set NAME=value --project-ref <ref>` | — | [H] | [supabase secrets](https://supabase.com/docs/reference/cli/supabase-secrets) | No MCP coverage for secrets at time of writing |
| link-project | — | `supabase link --project-ref <ref>` | optional | [H] | [supabase link](https://supabase.com/docs/reference/cli/supabase-link) | First-time link prompts for DB password (LR-03 — value should be sourced from env, not typed inline) |
| check-billing | — | — | required | [H] | [Supabase billing dashboard](https://supabase.com/dashboard/org/_/billing) | Dashboard-only |

## GitHub

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| list-issues | `mcp__github__list_issues` | `gh issue list` | — | [H] | [GitHub MCP](https://github.com/github/github-mcp-server); [gh CLI](https://cli.github.com/manual/) | Both work; MCP preferred for credential hygiene |
| create-pr | `mcp__github__create_pr` | `gh pr create` | — | [H] | GitHub MCP repo | Both work; **note**: `gh` can exit 0 with body errors on org-policy rejections (DEPLOY-EX-07 — §C lying-CLI case) |
| merge-pr | — | `gh pr merge` | optional | [H] | [gh CLI pr merge](https://cli.github.com/manual/gh_pr_merge) | **CLI-only**; Builder is auto-classifier-blocked from this per handoff §"Anthropic CLI auto-mode classifier" — Nick merges via web UI |
| set-secret | `mcp__github__set_repo_secret` | `gh secret set NAME --body <val>` | — | [M] | GitHub MCP repo | MCP and CLI both work; the CLI's `--body` flag inlines the value into args — prefer the MCP for LR-03 hygiene OR `gh secret set NAME --body "$(cat /dev/stdin)"` patterns |
| create-release | `mcp__github__create_release` | `gh release create <tag>` | — | [H] | GitHub MCP repo | Both work; MCP preferred |
| login (auth) | — | `gh auth login` | required | [H] | [gh auth login](https://cli.github.com/manual/gh_auth_login) | Device-code OAuth (same pattern as Vercel) |

## Stripe

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| create-product | `mcp__stripe__create_product` | `stripe products create` | — | [M] | [Stripe MCP](https://github.com/stripe/agent-toolkit); [Stripe CLI](https://docs.stripe.com/stripe-cli) | Both work; MCP preferred |
| create-webhook | `mcp__stripe__create_webhook_endpoint` | `stripe webhook_endpoints create` | — | [M] | Stripe MCP | Both work |
| forward-webhook (dev) | — | `stripe listen --forward-to <url>` | — | [H] | [Stripe webhook forwarding](https://docs.stripe.com/stripe-cli/webhook-forwarding) | **CLI-only**; long-running dev convenience tool; no MCP equivalent |
| process-refund | `mcp__stripe__create_refund` | `stripe refunds create --charge <id>` | — | [M] | Stripe MCP | Both work; payments specialist's PAY-EX-04 (tax-side-effect) applies regardless |
| portal-config | — | — | required | [H] | [Stripe customer portal](https://docs.stripe.com/customer-management/integrate-customer-portal) | Customer portal config requires browser-side dashboard interaction for branding / consent text |

## SendGrid / Resend

| Action | MCP server | CLI | Human-browser | Confidence | Source | Notes |
|---|---|---|---|---|---|---|
| send-email | — | — | — | [H] | [Resend API](https://resend.com/docs/api-reference/emails/send-email); [SendGrid API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) | **HTTP API only** — no first-party CLI or MCP at time of writing. Specialist invokes the API directly per `email/SKILL.md` Response shape |
| add-domain (DNS) | — | — | required | [H] | Provider docs | DNS records published at user's registrar; provider verifies. EMAIL-EX-01 handles unpropagated DNS |
| suppression-list-add | — | — | — | [H] | Provider APIs | HTTP API; some providers have CLI wrappers but they're community-maintained |

---

## Matrix gaps (rows to add on first need)

These platforms / actions appeared in PR #26's specialist updates but don't yet have matrix rows. Add a row when a specialist hits one during real work:

- AWS — `s3 cp`, `lambda invoke`, `secretsmanager get-secret-value`, `iam create-role`, `ses send-email`, `sqs send-message`
- GCP — `gcloud compute *`, `gcloud functions deploy`, `gcloud secrets create`
- Azure — `az * create`
- Cloudflare — `wrangler deploy`, `wrangler r2 *`, Cloudflare Images
- Sentry — `sentry-cli sourcemaps upload`, `sentry-cli releases new`, Sentry MCP (if any)
- Datadog — `datadog-ci sourcemaps upload`, dashboard-as-code, monitor management
- Honeycomb — `hny` CLI, Markers API
- Doppler / Vault / 1Password — secrets read / write / rotate (per `secrets/SKILL.md`)
- Railway — `railway up`, `railway deploy`, `railway init`
- Planetscale — `planetscale database create`, `planetscale branch create`
- DigitalOcean — `doctl apps create`, `doctl compute droplet create`
- BullMQ / Inngest / Trigger.dev — library-driven, may not need matrix rows
- Cloudflare R2 native — `wrangler r2 bucket create`, etc.

---

## Version log

- **2026-05-21** — Initial population (PR #27 / ADR-0033). 30 rows across 8 platforms. Gaps section enumerates 12 platforms / 40+ actions awaiting first-need.
