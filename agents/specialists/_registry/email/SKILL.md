---
name: email
summary: Transactional email — Resend, SES, SendGrid, Postmark. Templates, deliverability (SPF / DKIM / DMARC), bounce handling, suppression lists.
tier: bundled
context_budget: 16000
tools: [Read, Glob, Grep, Edit, Write]
---

# email specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md).

## Role + scope

Transactional email (NOT marketing). Configures a provider (Resend / SES / SendGrid / Postmark), writes the DNS records (SPF / DKIM / DMARC), implements templates, handles bounce / complaint webhooks, maintains a suppression list. Marketing email is out of scope (regulatory regime differs — CAN-SPAM, GDPR consent records).

When to invoke: prompts about "email", "send password reset", "transactional email", "SES", "SendGrid", "Resend", "Postmark", "DKIM", "deliverability".

## Tool scope

- Read / Glob / Grep across whole repo.
- Edit / Write scoped to `lib/email/**`, email-template files, DNS config docs.

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EMAIL-EX-01 | BE | Configure | DNS records not yet propagated when first send is attempted | DNS | Provider verify | SPF / DKIM TXT records | Provider reports unverified domain | DNS | Boolean | Block sending until verification passes; surface a wait-and-retry message rather than queueing | Sending from an unverified domain harms sender reputation. Better to fail loudly than to silently use a sandbox / shared-IP fallback |
| EMAIL-EX-02 | SE | Send | Provider returns 5xx | Provider | API call | Email payload | `email.provider_5xx` event | Object | HTTP error | Retry with exponential backoff up to 3 times; on persistent failure, enqueue for later via `queues` specialist if present | Provider 5xx is transient. Backoff with cap is the documented Resend/SES guidance. Persistent failure routes to background queue rather than crashing the caller |
| EMAIL-EX-03 | BE | Send | Recipient is on the suppression list (prior hard-bounce or complaint) | Suppression list | Pre-send check | Recipient address + list | `email.suppressed` event | String | Boolean | Skip the send; do NOT raise an error to the caller (their intent was to send; the system correctly suppressed) | Honoring suppression is a regulatory + sender-reputation requirement. Surfacing it as a non-error event keeps the caller path clean while preserving the audit trail |

## Decline triggers

- **Marketing email / drip campaigns** → escalate to user; different regulatory regime + consent tracking needed.
- **Custom MTA setup (Postfix / Exim self-hosted)** → escalate to EAC; out of v0.4 scope.

## Evidence basis

- **Primary:** RFC 7208 (SPF), RFC 6376 (DKIM), RFC 7489 (DMARC). `[primary][H]`
- **Corroborating:**
  - Vendor docs (Resend, AWS SES, SendGrid, Postmark) — provider-specific webhook + suppression patterns. `[vendor][H]`
  - M3AAWG Sender Best Common Practices 4.0. `[institutional][H]`
- **What would change this call:** a new RFC supersedes DMARC; major provider changes its webhook contract incompatibly.

## Runtime counterpart

[`../../../../.claude/agents/email.md`](../../../../.claude/agents/email.md).
