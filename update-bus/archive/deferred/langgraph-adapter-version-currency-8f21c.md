---
id: langgraph-adapter-version-currency-8f21c
source: research-feed
proposed_by: research-scout
date: 2026-08-03
affects:
  - adapters/langgraph/package.json
  - adapters/langgraph/durable.mjs
  - adapters/langgraph/guard.mjs
  - adapters/langgraph/README.md
  - adr/0050-second-adapter-langgraph.md
  - adr/0052-production-host-durable-execution.md
risk: medium
collapse_risk: true
source_tier: "1"
---

# Evaluate LangGraph.js adapter dependency currency (pinned ^0.2.0 vs. published 1.4.9)

## Proposed change

**Evaluate** — do not yet implement — bumping/auditing the `@langchain/langgraph` dependency pinned in `adapters/langgraph/package.json` (`^0.2.0`). The current published core line is `1.4.9` per the official GitHub releases feed and the npm registry (both polled live 2026-08-03). Because npm's caret range on a pre-1.0 version (`^0.2.0`) resolves only within `>=0.2.0 <0.3.0`, a fresh `npm install` in `adapters/langgraph/` cannot reach anything in the `0.3`–`1.4.x` line — including any interrupt/checkpoint fixes shipped since. The concrete next step this proposal recommends: run `adapters/langgraph/guard.test.mjs` and `durable.test.mjs` against a current `1.x` install to check API compatibility (the adapter uses `StateGraph`, `START`, `END`, `MemorySaver`, `interrupt`, `Command`, `Annotation` — all still present in `1.x` by name, but exact signatures are unverified here), then either bump the pin or document why not.

## Motivation

- **Why this matters more than a routine dependency bump:** `durable.mjs` (ADR-0052) is Loom's implementation of Kernel Rule 20 (destructive ops require confirmation) via LangGraph's `interrupt()` / `Command({ resume })`. This dependency sits on the governance-enforcement critical path, not an incidental one — a stale pin here is a stale pin on part of the enforcement mechanism itself.
- **Evidence the version gap is real:** confirmed live via two official channels, both polled/checked 2026-08-03: the GitHub releases Atom feed (`github.com/langchain-ai/langgraphjs/releases.atom`) shows `@langchain/langgraph@1.4.9` as the latest core release `[github-releases][H]`; the npm registry (`registry.npmjs.org/@langchain/langgraph` dist-tags) independently confirms `"latest":"1.4.9"` `[npm-registry][H]`. Both are official vendor-primary channels for the same package — this is a fact double-check across two distribution surfaces of the same publisher, not independent-publisher corroboration in the stricter journalistic sense, and I am flagging that distinction rather than overselling it.
- **Why it's not just a version number — recent fixes land in this adapter's exact problem space:** the 1.x release stream includes `@langchain/langgraph@1.4.9` changing checkpoint serialization for the `Topic` channel type (`[seen, values]` pairs → flat values, to align with the Python implementation) and `@langchain/langgraph-sdk@1.9.28` fixing a bug where `respond()` failed to clear the "hydrate interrupt allowlist," causing follow-on human-in-the-loop requests to not surface correctly `[github-releases][H]`. I could **not** confirm from the release notes alone whether `durable.mjs`'s actual usage (its state uses `Annotation.Root` reducers, not an explicitly declared `Topic` channel, and it imports `@langchain/langgraph` directly rather than the `langgraph-sdk`/platform client package where the interrupt-allowlist fix landed) is in the affected code path. That open question is exactly why this is framed as **evaluate**, not **implement**.
- **Dedup check:** grepped `adr/`, `lessons-learned/`, `update-bus/inbox/`, `update-bus/archive/` for `langgraph.*version`, `0.2.0`, `1.4.9`, and dependency-staleness language — no existing proposal or decision on record. ADR-0050/0052 (LangGraph adapter, durable execution) are accepted and describe the *design*, but neither addresses ongoing dependency currency.
- **Confidence: 65%** that a real compatibility gap or a missed governance-relevant fix exists. The version gap itself is confirmed at high confidence; whether it *functionally matters* for this adapter's specific code paths is not yet verified — that's the residual 35%.
- **What would raise this to 95%:** (1) running `durable.test.mjs`/`guard.test.mjs` against an installed `1.4.9` and diffing behavior; (2) reading LangGraph.js's `0.2 → 1.0` migration notes for breaking changes to `interrupt`/`Command`/`MemorySaver`/`Annotation` signatures; (3) confirming whether `durable.mjs`'s state shape triggers the `Topic`-channel checkpoint-format code path at all.

## Affected files

- adapters/langgraph/package.json
- adapters/langgraph/durable.mjs
- adapters/langgraph/guard.mjs
- adapters/langgraph/README.md
- adr/0050-second-adapter-langgraph.md
- adr/0052-production-host-durable-execution.md

## Critic review

## Human Replica recommendation

## User decision

verdict: defer (evaluated 2026-08-04)
decided_by: Nick Noel
decided_at: 2026-08-04
note: EVALUATION FINDINGS — (1) version gap real: caret ^0.2.0 cannot reach published 1.4.9. (2) BUT the governance-critical path is dependency-free: guard.mjs (the conformance-proven decision logic) imports NOTHING from @langchain/langgraph per package.json; only durable.mjs/example.run.mjs use the LangGraph runtime primitives, and while guard.test.mjs IS discovered+run by the suite (dependency-free), the LangGraph-DEPENDENT path (durable.mjs) is only exercised via durable.test.mjs which self-skips without an install. So the proposal premise (stale pin on the enforcement mechanism) is overstated — the enforcement DECISION has no LangGraph dep. (3) A blind 0.2 to 1.x major bump is unverifiable here: example.run.mjs needs a live model to exercise interrupt/Command/MemorySaver, so I cannot confirm the demo survives the bump. DEFER the bump to a focused adapter-maintenance task that installs 1.4.9, runs the example against a fake model, and reads the 0.2 to 1.0 migration notes. The actionable governance piece (version floors >= the ADR-0050 CVE-fixed versions) is already recorded in ADR-0050 security preconditions and applies IF/WHEN the adapter is deployed.