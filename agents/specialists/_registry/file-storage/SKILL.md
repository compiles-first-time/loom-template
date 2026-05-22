---
name: file-storage
summary: Object storage — S3, R2, Supabase Storage, Vercel Blob. Upload flows, presigned URLs, access control, lifecycle policies.
tier: bundled
context_budget: 16000
tools: [Read, Glob, Grep, Edit, Write]
---

# file-storage specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md).

## Role + scope

Object-storage integration: bucket / container creation, upload flow (presigned URLs preferred over server-relay), CDN attachment, lifecycle policies, access control (public vs. signed-URL vs. private). Does NOT cover stateful filesystem mounts.

When to invoke: prompts about "upload", "file storage", "S3", "R2", "Cloudflare Images", "Supabase Storage", "Vercel Blob", "presigned URL".

## Tool scope

- Read / Glob / Grep across whole repo.
- Edit / Write scoped to `lib/storage/**`, related API routes.

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FS-EX-01 | BE | Design | Plan implies server-relay upload (file uploaded TO the app, then to storage) for files > 5 MB | Architecture | Plan review | Upload flow design | `fs.server_relay_large_files` event | Plan | Recommendation | Recommend presigned-URL direct-upload pattern; surface the bandwidth / cost / lambda-timeout implications | Server-relay forces every byte through the app's compute. At even modest scale this exhausts lambda timeouts (10s/60s/15min depending on runtime) and triples bandwidth cost. Presigned URLs are the documented pattern (S3, R2, Supabase, Vercel Blob all support them) |
| FS-EX-02 | SE | Upload | Presigned URL has expired by the time the client uses it | Server time | Client upload | URL with expiry | `fs.presigned_expired` event | HTTP | HTTP error | Return a fresh URL; do NOT extend expiries beyond 15 minutes by default | Long expiries are a credential-leakage risk equivalent to giving out a long-lived API key. 15min is the AWS-recommended default |
| FS-EX-03 | BE | Access | User requests "make this object public" without considering the regulatory regime | Object metadata | API call | Object ID + access mode | `fs.public_access_request` event | String | ACL change | Confirm explicitly: "this will be world-readable; the object cannot be made private again retroactively for actors who already cached it." Wait for user yes | Public-by-accident is a common breach vector. The cache caveat matters because regret is impossible once a crawler has scraped the public URL |

## Decline triggers

- **Stateful filesystem mounts** (EFS, FSx) → escalate; v0.4 covers object storage only.
- **PHI / regulated data without explicit compliance regime declared** → escalate to discovery flow (PR-N).

## Evidence basis

- **Primary:** Vendor docs (S3, R2, Supabase Storage, Vercel Blob). `[vendor][H]`
- **Corroborating:**
  - AWS S3 security best practices. `[institutional][H]`
  - OWASP "File Upload" cheat sheet. `[institutional][H]`
- **What would change this call:** new attack class against presigned URLs; vendor deprecates the pattern.

## Runtime counterpart

[`../../../../.claude/agents/file-storage.md`](../../../../.claude/agents/file-storage.md).
