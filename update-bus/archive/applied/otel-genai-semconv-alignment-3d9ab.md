---
id: otel-genai-semconv-alignment-3d9ab
source: research-feed
proposed_by: research-scout
date: 2026-08-03
affects:
  - observatory/lib/otel.mjs
  - observatory/lib/otel.test.mjs
  - scripts/otel-export.mjs
  - adr/0051-opentelemetry-otlp-audit.md
  - layers/L6-observability.md
risk: low
collapse_risk: false
source_tier: "1"
---

# Evaluate aligning OTLP mapper attribute names with OTel's GenAI semantic conventions

## Proposed change

**Evaluate** — do not yet implement — aligning `observatory/lib/otel.mjs`'s attribute mapping with OpenTelemetry's official GenAI semantic conventions (`gen_ai.*` attribute names, e.g. `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.finish_reasons`, `gen_ai.client.operation.duration`) for any event-log field that represents LLM-call metadata, instead of the mapper's current behavior of passing every event-log key straight through as an arbitrarily-named OTLP attribute (`attributesFrom()` in `otel.mjs` is a generic key/value loop with no semantic-convention awareness).

## Motivation

- **Why now:** ADR-0051 (accepted 2026-07-06) built the zero-dep OTLP mapper explicitly so "any OTel backend... can ingest Loom's audit trail." A growing number of OTel-native backends render GenAI-specific dashboards keyed on the standard `gen_ai.*` attribute names — if any current or future Loom event carries model/token/latency fields under Loom's own key names, those backends won't recognize them as GenAI telemetry even though the data is present.
- **Evidence:** the OpenTelemetry project's own blog post, "Inside the LLM Call: GenAI Observability with OpenTelemetry" (`opentelemetry.io/blog/2026/genai-observability/`, published 2026-05-14, polled live via the configured feed 2026-08-03), documents the attribute set above, plus content-capture attributes (`gen_ai.input.messages`/`gen_ai.output.messages`, `gen_ai.system_instructions`) that OTel deliberately gates behind an explicit opt-in because "by default, no prompt content or tool arguments are captured" `[otel-blog][H]`.
- **Honest limitation — this is why it's "evaluate," not "implement":** cross-checking the canonical spec location (`opentelemetry.io/docs/specs/semconv/gen-ai/`) shows the GenAI conventions have since been **relocated** to their own repository (`github.com/open-telemetry/semantic-conventions-genai`) — the old spec page is now just a redirect notice. That relocation is a signal this area is still under active reorganization. I could not fetch the new repository's current stability marker (stable vs. experimental) within this run's fetch budget, so **I cannot confirm today's stability level** — adopting specific attribute names from a convention still being reorganized carries some rework risk. `[otel-semconv-redirect][M]`
- **Unverified but material:** I have not confirmed that any current Loom event actually carries LLM-call-shaped fields (model id, token counts) that this mapping would improve — a quick grep of `memory/event-log/` for `model`/`token` keys would settle whether this is a live gap or speculative future-proofing.
- **Dedup check:** grepped `adr/`, `lessons-learned/`, `update-bus/inbox/`, `update-bus/archive/`, and the repo generally for `gen_ai` and `semantic convention` — zero hits outside this proposal; not previously decided or queued.
- **Confidence: 60%** that this is worth doing now. The mapping mismatch (if any qualifying events exist) is real and cheap to fix; the main open questions are upstream-convention stability and whether a live gap currently exists at all.
- **What would raise this to 95%:** (1) confirming the GenAI semconv stability level at its new canonical repository; (2) confirming at least one real Loom event type with LLM-call-shaped fields that would benefit from the remapping — absent that, this stays a "watch, don't build yet" item.

## Affected files

- observatory/lib/otel.mjs
- observatory/lib/otel.test.mjs
- scripts/otel-export.mjs
- adr/0051-opentelemetry-otlp-audit.md
- layers/L6-observability.md

## Critic review

## Human Replica recommendation

## User decision

verdict: approve (implemented)
decided_by: Nick Noel
decided_at: 2026-08-04
note: The open question resolved YES — loop_cost_summary + session_token_usage carry model+token fields. Implemented additive gen_ai.* aliases in observatory/lib/otel.mjs (GENAI_ALIASES), originals kept, 6 new tests. Upstream semconv still reorganizing, so aliases are centralized for a one-line rename. ADR-0051 updated.