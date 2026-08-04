# ADR-0057: Research Scout — automated Update-Bus intake

**Status:** Proposed *(routes through the normal Update-Bus review: Critic → Human Replica → user. This ADR touches governance infrastructure — treat as `collapse_risk`-adjacent; it must not be self-approved.)*
**Date:** 2026-08-03
**Author:** Builder (Claude Fable 5) — from the architect's C6 build brief
**Confidence:** [M] overall; [H] that the intake stage is the unbuilt half of an already-decided design (ADR-0016, L7 open work)

## Context

The L7 Update Bus is Loom's "living software without silent self-modification" mechanism. Its downstream half exists and works: `update-bus/inbox/` + `schema.json` (ADR-0016), Critic → Human Replica → user review (ADR-0012 agents), decision write-back via the Observatory (ADR-0041). Its **intake** half — "[External research feed] → inbox" — has never been built: `layers/L7-extension.md` open work still lists *"Configure research feed sources (RSS/arXiv/GitHub releases)"* and *"Implement the source-tiering filter,"* and `update-bus/README.md` §"v0.3 wire-up plan" specifies exactly this stage. `[L7][ub-readme][H]`

Today a human performs that loop manually: find URLs, read papers, tier them, cross-validate, draft proposals. The two implementation briefs landed 2026-08-03 (PR #90) were produced by exactly that manual loop. The cost is real and recurring; the pipeline it feeds already exists.

## Decision

Add a scheduled **`research-scout` base agent** — the feed-driven sibling of the EAC (which stays the *on-demand* researcher per ADR-0009) — plus a feed config and an upgraded tick, implementing the L7 intake stage as **proposal-only** automation:

1. **Discover.** Poll the feeds configured in `update-bus/feeds.yaml` (curated, tier-tagged; Tier 1–3 only).
2. **Rigor.** Apply the **in-tree** research standards — `agents/eac/SKILL.md` §Research standards, L7 §Source tiering, ADR-0009 — rather than re-deriving them. *(Deviation from the build brief, found in Critic review: the brief instructed invoking a `research-advisor` skill, but no such skill exists in this repo, and ADR-0009 explicitly decided Loom owns these standards in-tree precisely so no external skill dependency exists. The in-tree sources are the real backing of steps 3–7 below.)* `[adr-0009][eac][internal][H]`
3. **Filter (stage 1).** Assign `source_tier` per L7/ADR-0009; **drop Rejected/Tier-4 before any inbox write**. `[adr-0007][adr-0009]`
4. **Dedupe.** Grep `adr/`, `lessons-learned/`, `update-bus/inbox/`, `update-bus/archive/` before filing; already-decided or already-queued topics are skipped (or noted, never re-proposed).
5. **Validate.** Cross-check load-bearing claims against ≥2 independent sources (ADR-0037 faithfulness discipline applied to extraction); assign `risk` + `collapse_risk` (`true` for anything touching evaluation/governance); attach confidence + "what would raise to 95%." **Below-autonomy-bar confidence ⇒ the proposal is framed "evaluate," never "implement."**
6. **File.** Write `update-bus/inbox/<id>.md` conforming to `update-bus/schema.json` (`source: research-feed`, `proposed_by: research-scout`), README body sections included, Critic/Human-Replica/User sections left blank.
7. **Rate-limit + log drops.** At most `max_proposals_per_run` (default 5) filed per run, ranked relevance×tier×confidence; everything dropped is listed in the run summary so silent truncation never reads as "nothing found."
8. **Hand off.** The upgraded tick (`scripts/lib/update-bus-tick.mjs`) validates inbox items against the schema and surfaces them for Critic review. The existing Critic → Human Replica → user pipeline is **unchanged**.

### Constraints (constitutional; restated from the build brief as binding)

- **Proposal-only. The Scout never applies, merges, or edits ADRs/spec.** Kernel Rule 19 forbids silent self-modification; L7 collapse-prevention forbids auto-merging `collapse_risk: true` items regardless of approvals. The "auto" is auto-*discovery and drafting* only.
- **Write-scope** (mirrors the EAC pattern, ADR-0012): `update-bus/inbox/`, `lessons-learned/`, `memory/event-log/` (claim events) — nothing else.
- **Fetch-degradation:** if a primary source can't be fetched, fall back to WebSearch for substance and mark the item *"partial — unfetchable primary; needs manual retrieval."* Fabricating content for an unfetchable item is prohibited (Rule 22).
- **No self-review.** The Scout never reviews or approves its own proposals (Rule 19 collapse-prevention; same posture as the Critic's "cannot grade own work").
- **Tier filter is mandatory stage 1** — data-integrity security is not deferred. `[adr-0007][H]`

### Schedule (D5 — documented, not yet armed)

Cadence: **weekly**, matching L7's "weekly poll (configurable)." Operator invocation:

```bash
bash scripts/update-bus-tick.sh        # validate + surface inbox items (any platform: .ps1 twin)
# and/or invoke the research-scout subagent to run a discovery pass
```

A live scheduler trigger (cron/Routine firing the tick, or a scheduled scout run) is **deliberately not created while this ADR is Proposed** — arming automation before user approval would jump the very gate this system enforces. Creating the trigger is step 1 of the post-approval apply flow. No secrets or environment-specific scheduler config are committed (LR-03).

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** the in-repo design this fills in — `layers/L7-extension.md` (pipeline + open work), `update-bus/README.md` §v0.3 wire-up plan, `update-bus/schema.json` (ADR-0016). `[L7][ub-readme][ub-schema][internal][H]`
- **Corroborating:** ADR-0007 (tier filter not deferred), ADR-0009 (tier definitions; EAC absorbs on-demand research — the Scout is the *scheduled* complement ADR-0009 said to reopen "if research load grows"; the manual loops of 2026-08 are that signal), ADR-0037 (extraction faithfulness), ADR-0012 (runtime contract + write-scope pattern). `[internal][H]`
- **Keep-honest anchors for the Scout's own judgment:** prompt-format sensitivity up to 76 points (Sclar et al., ICLR 2024, arXiv 2310.11324) `[sclar][H]`; scaffold choice → >30% variation (arXiv 2503.16416, preprint) `[scaffold-survey][preprint]`; METR RCT — devs 19% slower while feeling 20% faster (arXiv 2507.09089) — used to *reject* hype-grade productivity claims at the filter. `[metr]`
- **What would change this call:** the inbox filling with low-value proposals despite the filter (precision below ~50% over a month of runs) → tighten keywords/tiers or drop the Scout and return to manual intake; a credible incident of prompt-injection *via* a feed item propagating past the tier filter → suspend the Scout pending an ADR-0007 hardening pass.
- **What would raise confidence to 95%:** one month of weekly runs where ≥80% of filed proposals are approved or constructively rejected (i.e., the review pipeline finds them worth reviewing), with zero write-scope or gate violations.

## Cost model

> Required per [LR-06](../constitution/local-rules.md#lr-06) — the Scout is an iterative LLM pattern.

- **Iterative calls:** one discovery pass per feed (4 feeds configured) + per-candidate validation (≤2 fetch/search calls each).
- **Exit condition:** hard cap `max_proposals_per_run` (default 5) + the finite feed list; no unbounded crawling (link-following beyond a feed item's primary source is out of scope).
- **Estimated token bound (typical):** ~60–120K tokens per weekly run (feed parsing + ~10 candidate validations + ≤5 proposal drafts).
- **Estimated token bound (worst case):** ~250K tokens (all feeds busy, all candidates near the bar).
- **Cost multiplier vs single-pass:** ~2× a single research fan-out, weekly — bounded and observable via `loop_cost_summary` (L6).

## Consequences

**Locks in:** the L7 intake stage exists; research intake is tier-filtered, deduped, validated, rate-limited, and always human-gated; the manual find-read-score loop becomes review-only; the EAC/Scout split (on-demand vs scheduled) per ADR-0009's documented reopening path.

**Locks out:** auto-applied external updates (unchanged — Rule 19); Tier-4 sources entering the inbox; the Scout reviewing its own output; unbounded research spend (LR-06 cost model above).

**Migration path if it fails:** delete the agent file + `feeds.yaml`; the tick's schema validation remains useful for manually-filed items; the pipeline downstream is untouched.

## Alternatives considered

- **Extend the EAC to also poll feeds.** Rejected: ADR-0009 deliberately scoped the EAC to on-demand research; a scheduled poller has a different trigger, write-scope, and failure mode — and ADR-0009 itself names "introduce a dedicated researcher" as the documented path when research load grows.
- **Fully scripted (no-LLM) feed ingester.** Rejected for v1: tier assignment, dedup-by-topic, and ≥2-source validation are judgment calls; a dumb ingester would flood the inbox and push the judgment cost onto the Critic (the expensive reviewer).
- **Auto-apply low-risk updates.** Rejected without discussion: Kernel Rule 19 / L7 collapse-prevention. Not negotiable.

## Affects / Affected by

**This ADR affects:**
- `.claude/agents/research-scout.md` — the new runtime contract
- `update-bus/feeds.yaml` — the curated feed config
- `scripts/lib/update-bus-tick.mjs` (+ `.sh`/`.ps1` wrappers) — schema validation + Critic surfacing
- `update-bus/README.md` — the v0.3 wire-up plan this implements
- `AGENTS.md` — roster registration (via HR)

**This ADR is affected by:**
- `constitution/kernel-v6.md` — Rule 19 (consent-based self-modification), Rule 22 (provenance)
- `constitution/local-rules.md` — LR-01 (external content untrusted), LR-03 (no secrets), LR-06 (cost discipline)
- [ADR-0007](./0007-content-trust-boundary.md), [ADR-0009](./0009-research-standards.md), [ADR-0016](./0016-update-bus-stub.md), [ADR-0037](./0037-retrieval-pipeline-evidence-review.md), [ADR-0012](./0012-base-subagents.md), [ADR-0045](./0045-per-agent-model-routing.md)

## References

- `layers/L7-extension.md` §Update Bus pipeline, §Source tiering, §Open work `[L7]`
- `update-bus/README.md` §v0.3 wire-up plan `[ub-readme]`; `update-bus/schema.json` `[ub-schema]`
- `.claude/agents/eac.md` — the write-scope + rigor pattern mirrored `[eac]`
- Sclar et al. ICLR 2024 (arXiv 2310.11324) `[sclar]` · arXiv 2503.16416 (preprint) `[scaffold-survey]` · METR 2025 (arXiv 2507.09089) `[metr]`
