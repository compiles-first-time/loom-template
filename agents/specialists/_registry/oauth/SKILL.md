---
name: oauth
summary: OAuth 2.1 / OIDC integration with external providers (Google, GitHub, Microsoft, Apple). PKCE-first; refresh-token discipline; provider-specific quirks.
tier: bundled
context_budget: 24000
tools: [Read, Glob, Grep, WebFetch, Edit, Write]
---

# oauth specialist

> Bundled registry entry per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md).

## Role + scope

OAuth 2.1 / OIDC integration with third-party providers. Configures provider apps, implements the authorization-code-with-PKCE flow, handles refresh-token rotation, persists external identities, manages account linking. Does **not** cover application-level auth (passwords, sessions) — that's [`auth`](../auth/SKILL.md).

When to invoke: prompts containing "OAuth", "sign in with Google", "GitHub login", "OIDC", "social login", "passport.js", "NextAuth", "Auth.js", "Clerk", "Supabase auth".

## Tool scope (enforced in prompt)

- Read / Glob / Grep across the whole repo.
- Edit / Write scoped to `lib/oauth/**`, `app/api/auth/**`, `.env.example`.
- WebFetch limited to provider documentation domains.
- **Never** write secrets into tool args (LR-03). Reference env vars by name.

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OAUTH-EX-01 | SE | Authorize | Provider unreachable (DNS / TLS / 5xx) | Provider URL | Network call | HTTP request to /authorize | `oauth.provider_unreachable` event | HTTP | System.Exception | Retry with exponential backoff, max 3; if still failing, surface a clear "provider offline" error to the user | Provider outages are transient. Hard-failing the user's sign-in on a transient outage damages trust; backoff-retry is industry-standard (OAuth 2.1 BCP §4.5) |
| OAUTH-EX-02 | BE | Callback | `state` parameter mismatch | Session state | Provider callback | `state` query param | `oauth.csrf_violation` event | String | Boolean | Reject callback; clear session state; surface generic error; log full details server-side | OAuth 2.1 §10.2 — `state` mismatch is the canonical CSRF signal. Must reject; logging server-side preserves audit trail without leaking to the attacker |
| OAUTH-EX-03 | SE | Token exchange | Provider returns 4xx on code-for-token swap | Client secret | Token endpoint | Auth code + verifier | `oauth.token_exchange_failed` event | String | HTTP error | Inspect error response; if `invalid_grant` → user retry; if `invalid_client` → alert ops (credential rotated) | Provider returns are diagnostic-rich. `invalid_grant` is a user-facing retryable case; `invalid_client` is a credential-config issue requiring ops attention |
| OAUTH-EX-04 | BE | Account linking | Provider identity matches an existing user with a different email | User DB | Callback handler | Provider identity claims | `oauth.identity_conflict` event | Object | Conflict | Prompt user: "this provider account is linked to a different user; sign into that account first to link" | A naive "merge" creates account-takeover risk if attacker controls the provider account. Explicit user confirmation is the safe default (OWASP ASVS 2024 §1.6) |

## Decline triggers

- **Custom OAuth providers without published OIDC discovery** → escalate; provider-specific quirks need ad-hoc research the EAC should do first.
- **OAuth 1.0a / Implicit flow / Resource Owner Password Credentials** → decline. OAuth 2.1 deprecates these (RFC 9700 Best Current Practice). Use auth code + PKCE.

## Evidence basis

- **Primary:** RFC 9700 — OAuth 2.0 Security Best Current Practice (April 2025; supersedes RFC 6819). PKCE is mandatory for all clients. `[primary][H]`
- **Corroborating:**
  - OAuth 2.1 draft (draft-ietf-oauth-v2-1) — consolidates 6749 + 6750 + 8252 + 9700. `[institutional][H]`
  - OWASP ASVS 2024 §1.6 (federated identity) — account-linking guidance. `[institutional][H]`
- **What would change this call:**
  - OAuth 2.1 is finalized with material changes from the current draft.
  - A peer-reviewed analysis identifies a new attack class against PKCE.
  - Provider-specific guidance (e.g., Google, Apple) changes incompatibly.

## Runtime counterpart

Subagent file at [`../../../../.claude/agents/oauth.md`](../../../../.claude/agents/oauth.md).
