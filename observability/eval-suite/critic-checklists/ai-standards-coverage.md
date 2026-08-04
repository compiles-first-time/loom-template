# Critic checklist — AI-standards coverage (NIST AI RMF + OWASP LLM Top 10:2025)

> Coverage matrix of Loom's own controls against two externally-authored standards. Origin: inbox item `improve-nist-owasp-coverage-mapping-f6a06` (2026-08 internal audit). The value of an **external** checklist is that it finds the blind-spot class self-reflection can't — every "Gap" row below is a candidate ADR.
>
> **Sources (verified 2026-08-04):**
> - OWASP Top 10 for LLM Applications **2025**, canonical list at `genai.owasp.org/llm-top-10/` `[owasp][H]` (Tier 1 — named institutional standard).
> - NIST AI Risk Management Framework 1.0, four Core functions from `airc.nist.gov` `[nist][H]` (Tier 1 — official US standard).
>
> This is a **coverage map, not a compliance claim.** "Covered" = Loom has a named, real control addressing the risk; "Partial" = addressed but with a stated limitation; "Gap" = no control, filed or fileable as an ADR/inbox item. The Critic re-runs this in the monthly internal audit; a control that regresses (e.g. a check deleted) flips its row.

## OWASP LLM Top 10:2025

| ID | Risk | Loom coverage | Status |
|---|---|---|---|
| LLM01 | Prompt Injection | LR-01 (external content untrusted); admission-check.mjs axis 3 (obvious-injection floor, ADR-0008); research-scout treats fetched content as data | **Partial** — obvious patterns only; subtle/obfuscated injection is agent judgment (no classifier) |
| LLM02 | Sensitive Information Disclosure | LR-03 (secrets never in chat/args); `scripts/lib/secret-patterns.mjs` + pre-tool-use redaction; observatory redactor | **Covered** |
| LLM03 | Supply Chain | ADR-0050 security preconditions (version pinning ≥ fixed floors, NVD-verified CVE table); zero-runtime-dep ethos (ADR-0039) | **Partial** — no automated dependency-CVE check; `langgraph-adapter-version-currency` shows staleness can go unnoticed |
| LLM04 | Data and Model Poisoning | LR-01 + ADR-0007 (retrieved content quarantined/untrusted); source-tier filter (ADR-0009) + obvious-reject floor | **Covered** (for the data-integrity axis Loom scopes; model-training poisoning is out of scope — Loom is not a training system) |
| LLM05 | Improper Output Handling | Critic pre-commit review; verifier gates (ADR-0044); destructive-op guard on tool outputs | **Partial** — output validation is judgment + verifier-gated, not a typed output sanitizer |
| LLM06 | Excessive Agency | Kernel Rule 2/8/20; destructive-action confirmation (ADR-0047); per-agent tool allowlists + write-scopes (ADR-0012); proposal-only agents (research-scout) | **Covered** |
| LLM07 | System Prompt Leakage | Agents carry no secrets in prompts (LR-03); prompts are in-repo and non-sensitive by design | **Covered** (by construction — no secret lives in a system prompt to leak) |
| LLM08 | Vector and Embedding Weaknesses | ADR-0007 quarantine is designed for it; **but the vector index isn't built yet** (empty scaffold) | **N/A today / Gap-on-build** — when ADR-0055 Phase 1 lands the embedding index, this row must become an active control (poisoned-embedding + MEXTRA-style extraction, both cited in ADR-0007) |
| LLM09 | Misinformation | Confidence calibration + `what-would-raise-to-95`; ≥2-source cross-validation (ADR-0009); calibration scorer (2026-08); provenance tags (Rule 22) | **Covered** |
| LLM10 | Unbounded Consumption | LR-06 (cost discipline, exit conditions, token bounds); `loop_cost_summary`; Models & Budget caps (ADR-0045) | **Partial** — caps are documented/observed; the cost accounting itself is buggy (`OB-COST-01`) so enforcement is not yet trustworthy |

## NIST AI RMF — four Core functions

| Function | NIST intent | Loom coverage | Status |
|---|---|---|---|
| **GOVERN** | culture of AI risk management, cross-cutting | The whole constitutional kernel + local rules + Critic/Constitution-Service; ADRs as auditable decisions; Rule 19 consent gate | **Covered** — this is Loom's core competency |
| **MAP** | frame context: purpose, capability, impact | Discovery flow (L8, ADR-0025/0026); requirements & exceptions registry (ADR-0046); risk-register | **Partial** — strong when a project runs discovery; the template itself has placeholder discovery docs |
| **MEASURE** | quantitative/qualitative risk analysis + monitoring | Eval suite; efficacy harness (ADR-0054); calibration scorer; adversarial corpus; mutation drill; Observatory | **Partial** — good and improving; outcome metrics blocked on `OB-COST-01`; drift signals are integration targets |
| **MANAGE** | prioritize, respond, monitor deployed risk | Update Bus (human-gated response); monthly internal audit; lessons-learned loop; ticket/kanban | **Covered** for dev-time; production-deployment risk management is explicitly deferred (ADR-0054 phasing) |

## Gaps worth an ADR (ranked)

1. **LLM08 gap-on-build** — the moment the ADR-0055 embedding index exists, poisoned-embedding + extraction defenses must be active, not designed. Highest future-risk; pre-register the control now.
2. **LLM03 / supply chain** — no automated dependency-CVE/staleness check; the LangGraph pin drift proves it recurs. Candidate: a `dependency-currency` doctor check.
3. **LLM10 / cost enforcement** — `OB-COST-01` must be fixed before any spend cap is trustworthy.
4. **LLM01 / LLM05 depth** — obvious-pattern floors exist; a measured decision on whether subtle-injection / output-typing controls are worth building (vs. left to judgment) belongs in an ADR, not left implicit.

None of these are new emergencies — they are the honest edges of a system that scores **Covered/Partial across the board with zero uncovered Govern-axis rows**. The point of running an external checklist is exactly to surface edges like LLM08 that in-tree review kept missing because the feature isn't built yet.
