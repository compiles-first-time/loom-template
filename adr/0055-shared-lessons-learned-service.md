# ADR-0055: Shared Lessons-Learned Service — relevance-pull, on-demand query, dedup push

**Status:** Accepted (Nick, 2026-07-12 — the architect's lessons-learned asks; design proposed from process-cartographer Phase-1)
**Date:** 2026-07-12
**Author:** Builder (Opus 4.8) — adopting `docs/proposals/lessons-learned-service.md` (authored in process-cartographer, from Nick's idea)
**Confidence:** [H] that the current per-repo-copy model doesn't scale; [M] on the exact store/index tech (tune in the phased rollout)

---

## Context

The architect wants Loom's lessons-learned to actually **compound** across projects — three asks:
1. **Load the lessons *relevant to this project*** (its stack/domain), not everything.
2. **Query them live as the project advances** — "has anyone hit this before?" against the *full* corpus, on demand.
3. **Organize + add lessons for future projects** — a real cross-project institutional memory.

Today every Loom project carries a **full copy** of `lessons-learned/` and it doesn't scale: redundant/stale copies (a fix in one repo doesn't reach the others), unshared discoveries (a lesson in project A is invisible to B unless hand-copied), no relevance filter (a new project inherits *all* lessons, most irrelevant — noise), and no on-demand recall (an agent can only search what's already local). This is the operational gap under ADR-0054's **memory-compounding** axis — the differentiator is currently per-repo dead weight.

The design was worked out during the process-cartographer Phase-1 build and carried here as `docs/proposals/lessons-learned-service.md`. This ADR adopts it.

## Decision

Adopt a **Lessons-Learned Service**: a canonical, versioned, auditable store + a derived semantic index + a thin per-project client.

- **Canonical store** — a git repo (`loom-lessons/`), one Markdown file per lesson, PR-reviewed, full history, clone-able offline. Git for auditability + offline (matches Loom's spec-as-codebase discipline); it is the source of truth.
- **Index layer** — a *derived, rebuildable* vector + metadata index (embedding per lesson; metadata: domain/stack/platform/severity/dates/provenance) for fast semantic recall. Never the source of truth — mirrors ADR-0037's retrieval discipline (hybrid + rerank + confidence gating), not a new one.
- **Client** — a `loom lessons` CLI (in every project's `scripts/`) + an MCP tool wrapper so subagents recall directly:
  - **`pull`** (on bootstrap / on demand): reads the project's discovery profile (`discovery/quick-scan.md` → stack/platform/domain) and fetches only the top-relevant lessons into `lessons-learned/_cache/` (metadata filter + vector similarity). *Ask 1.*
  - **`search "<q>"`**: semantic + keyword over the **full** index (beyond the local cache), ranked with provenance + confidence; `pull <id>` materializes a hit locally. *Ask 2.*
  - **`add` / `update`**: author locally (normal authoring), tagged `share: true|false`.
  - **`push`**: propose shareable lessons to the store — gated by (a) a **dedup/supersede** step (embed → nearest-neighbor; if too similar, update/supersede the existing lesson instead of adding a 500th copy), (b) a **critic** review (provenance, confidence-vs-evidence, genuinely shared not project-secret), (c) **`secrets-doctor`** over the body. Submission = a PR / Update-Bus item; on merge it re-embeds. *Ask 3.*

- **Standardized lesson schema** (makes the existing `lessons-learned/*.md` ingestable — they're ~90% there): frontmatter gains `id`, `title`, `domain[]`, `stack[]`, `platform[]`, `severity`, `share`, `supersedes` (LR-05), `provenance{origin_project, sources, confidence}` (Rule 22), `created`/`updated`, `embedding_hash`.

### Phased rollout (proof-first — each phase is independently useful)
- **Phase 0 (now, zero-infra):** standardize the frontmatter schema in loom-template's `lessons-learned/`; ship `loom lessons search` over the **local** files (keyword + optional local embeddings); a `doctor` soft-check that lessons carry the schema. No service yet.
- **Phase 1 (canonical store):** create the `loom-lessons` git repo; `pull` sparse-fetches by metadata; a downloadable **prebuilt local index** (sqlite + embeddings) for offline semantic `search`; `push` = a PR.
- **Phase 2 (hosted index + on-demand):** a small pgvector service (Loom has a Supabase specialist) fronts the index; an **MCP tool** exposes `lessons.search`/`lessons.pull` for subagents. `push` stays PR-gated.
- **Phase 3 (auto-contribution):** on `Stop`/handoff, auto-open a contribution PR for newly-authored `share: true` lessons, landing in a review queue.

**Constitution-service review is required before Phase 2+** — a cross-project shared store touches data-egress, secret hygiene, and consent-based self-modification (Rule 19 / LR-03); the dedup + critic + secrets-doctor + human-review gates are mandatory, not optional.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** the architect's lessons-learned asks (2026-07-12); the process-cartographer Phase-1 proposal (`docs/proposals/lessons-learned-service.md`) grounded in building a real project on Loom. `[user-direction][H]`
- **Corroborating:** [ADR-0037](./0037-retrieval-pipeline-evidence-review.md) (the retrieval discipline this reuses at the cross-project tier), [ADR-0014](./0014-lessons-auto-suggest.md) (local auto-suggest — the capture end), [ADR-0030](./0030-specialist-lifecycle.md) `promote-lessons` (the cross-project promotion this operationalizes), [ADR-0016](./0016-update-bus-stub.md)/L7 (the propagation channel), [ADR-0054](./0054-path-to-top-tier-proof-first.md) (the memory-compounding axis this makes real). `[internal][H]`
- **What would change this call:** if a project fleet stays small enough that per-repo copies never diverge (unlikely), the store is over-engineering → keep Phase 0 (schema + local search) only.

> **Open question (2026-08-03, evaluate-only — no implementation):** consider **contrastive capability-gap diagnosis** (TRACE Step 1, arXiv 2604.05336, preprint `[trace preprint][60–80%]`) as a failure-analysis technique for lessons and the reputation signals of [ADR-0053](./0053-agent-reputation-and-dispatch.md): contrast an agent's pass vs fail trajectories to name *which reusable capability* recurs in its failures — a sharper lesson/`verifier_fail` annotation than raw error text. **Diagnosis only.** TRACE Steps 2–4 (RL/LoRA/MoE training) are explicitly out of scope: they break model-agnosticism (ADR-0048), require training infra Loom does not have, and fail LR-06 cost discipline. *What would raise confidence:* peer review of the preprint + an independent reproduction of the diagnosis step's usefulness.

## Consequences

**Locks in:** git-canonical + derived-index (source-of-truth vs speed separation); a standardized, DB-ready lesson schema; relevance-pull + on-demand-search + dedup-push as the model; provenance (Rule 22) + supersede-not-delete (LR-05) + secret-hygiene on every path.

**Locks out:** full-copy-per-repo as the only model; unversioned central DBs (no audit/offline); auto-merge of contributions (Rule 19 consent); duplicate-lesson sprawl (the dedup gate).

**Migration/fallback:** additive — Phase 0 just enriches existing files + adds a search CLI; existing `lessons-learned/` keeps working. Drop the later phases and nothing regresses.

## Alternatives considered

- **Status quo (full copy per repo).** Rejected — doesn't scale; the problem statement.
- **Central DB as source of truth (no git).** Rejected — loses auditability, PR review, offline clones; git-canonical + derived-index keeps both.
- **Auto-merge contributions.** Rejected — violates Rule 19 (consent-based self-modification); contributions are critic + human reviewed.
- **General knowledge base for arbitrary docs.** Rejected for v1 — scoped to *lessons* (failure → fix, with provenance).

## Affects / Affected by

**Affects:** `lessons-learned/` (schema standardization), `scripts/` (`loom lessons` CLI), a new `loom-lessons` store (Phase 1), `scripts/lib/doctor.mjs` (lesson-schema soft-check, Phase 0), `docs/proposals/lessons-learned-service.md` (this adopts it), an MCP tool (Phase 2).

**Affected by:** `adr/0037-retrieval-pipeline-evidence-review.md`, `adr/0014-lessons-auto-suggest.md`, `adr/0030-specialist-lifecycle.md`, `adr/0016-update-bus-stub.md`, `adr/0054-path-to-top-tier-proof-first.md`; `constitution/kernel-v6.md` Rule 22 (provenance) + Rule 19 (consent); `constitution/local-rules.md` LR-03 (secret hygiene) + LR-05 (supersede).

## References

- `docs/proposals/lessons-learned-service.md` — the full design (process-cartographer, 2026-07-10)
- ADR-0037 (retrieval), ADR-0014 (auto-suggest), ADR-0030 (promote-lessons), ADR-0054 (memory-compounding axis)
- L3 (memory architecture), L7 (Update Bus / self-extension)
