# ADR-0058: Kernel-integrity pin — the kernel is never overwritten by code

**Status:** Accepted
**Date:** 2026-08-04
**Author:** Builder (Claude Fable 5) — architect direction 2026-08-04
**Confidence:** [H] on the mechanism; the enforcement is deterministic

## Context

Architect direction (2026-08-04): *"The kernel must never be overwritten by a program or code and must be manually done. Perhaps always validating that the kernel is a 1:1 from one commit to the next?"*

Kernel Rule 19 already declares foundational rules 1–8 effectively immutable and amendable only via a transparent, consent-based process. [ADR-0047](./0047-hook-enforced-destructive-action-confirmation.md) already lists `constitution/kernel-v6.md` in the destructive-guard's `immutableFiles`, so the PreToolUse hook **denies** an agent's attempt to edit it. But that is prevention at one seam only — a raw write, a bypassed/absent hook (the "Loom is inert outside the template cwd" failure mode, lesson 2026-08-04), or a non-Claude host would not be caught. There was no commit-to-commit **detection** that the kernel is byte-for-byte what it was.

## Decision

Add a **kernel-integrity pin**: a committed SHA-256 of `constitution/kernel-v6.md` (EOL-normalized), verified by a `loom doctor` **hard check**. Any change to the kernel that is not accompanied by a deliberate human re-pin fails the build loudly.

- **Pin file:** `constitution/kernel-v6.sha256` (tracked) — the EOL-normalized SHA-256 of the kernel, with a header stating that re-pinning is a deliberate constitutional act.
- **Library:** `scripts/lib/kernel-integrity.mjs` — pure `hashKernel`/`parsePin`/`checkKernelIntegrity`, plus a CLI: default = check (exit 1 on mismatch/no-pin/no-kernel), `--repin` = the human-sanctioned regenerate path.
- **Doctor hard check:** `kernel-integrity` — mismatch is a hard failure with a message that names the Rule-19 manual-amendment requirement and refuses the "re-pin to silence" shortcut.
- **EOL-normalized** (`\r\n → \n`) so a Windows CRLF checkout under `core.autocrlf` never trips a false mismatch (lesson 2026-08-03, the same class as the mcp-yaml phantom-drift fix).

**The sanctioned amendment path (the only way the kernel legitimately changes):** a human (a) makes the change, (b) records an ADR + override-authority sign-off per Rule 19, and (c) runs `node scripts/lib/kernel-integrity.mjs --repin` in the same commit. No agent/program does this autonomously; `--repin` only records a hash — it cannot itself authorize an amendment.

### Honest scope of enforcement

This makes an unauthorized kernel change **impossible to do silently** — it is caught commit-to-commit and blocks doctor/CI. It does **not** cryptographically prevent a determined local actor from editing both the kernel and the pin (nothing in a local git repo can). The guarantee is *detection + a forced conscious human step*, layered on ADR-0047's *prevention*; together they satisfy the architect's "manual, never by code" intent. A future hardening (out of scope) could sign the pin with an override-authority key.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** architect direction 2026-08-04 (kernel must be manually amended; validate 1:1 across commits). `[user-direction][H]`
- **Corroborating:** Kernel Rule 19 (foundational immutability); [ADR-0047](./0047-hook-enforced-destructive-action-confirmation.md) (hook-level immutable-files prevention this detects behind); the CRLF phantom-drift lesson (why the hash is EOL-normalized). `[internal][H]`
- **What would change this call:** if signing the pin (override-authority key) becomes warranted, this ADR is superseded by a signed-pin scheme; the check structure is unchanged.

## Consequences

**Locks in:** every commit is verifiable against a known-good kernel hash; a silent/programmatic kernel overwrite is caught and blocks; the only green path through a kernel change is a deliberate human re-pin.

**Locks out:** silent kernel drift; an agent "fixing" or "improving" the kernel and passing CI; accidental kernel edits going unnoticed.

**Migration/fallback:** additive — a pure lib + one hard check + a tracked hash file. Remove the check and the pin and nothing else regresses.

## Alternatives considered

- **Rely on ADR-0047's hook alone.** Rejected: single-seam prevention; no detection when the hook doesn't run (inert-outside-cwd, non-Claude host, raw write).
- **Git hook / CI-only check.** Rejected as the *sole* mechanism: not every clone runs the same CI; doctor is Loom's portable, in-repo conformance surface, so the check belongs there (a CI gate can additionally run `loom doctor`).
- **Signed pin now.** Deferred: key management is real scope; hash-pin + hard check already delivers "no silent change," which is the stated requirement.

## Affects / Affected by

**This ADR affects:**
- `constitution/kernel-v6.sha256` (new pin), `scripts/lib/kernel-integrity.mjs` (+ `.test.mjs`), `scripts/lib/doctor.mjs` (new `kernel-integrity` hard check)

**This ADR is affected by:**
- `constitution/kernel-v6.md` Rule 19 (the immutability this enforces); [ADR-0047](./0047-hook-enforced-destructive-action-confirmation.md) (prevention layer); [ADR-0015](./0015-loom-doctor.md) (doctor extension protocol)

## References

- `scripts/lib/kernel-integrity.mjs`, `constitution/kernel-v6.sha256`
- Kernel Rule 19; ADR-0047; lesson `2026-08-03-crlf-byte-compare-phantom-drift`
