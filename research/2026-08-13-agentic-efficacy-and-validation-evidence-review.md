# Evidence review — agentic-platform efficacy, and whether Loom's validation method is the right one

**Date:** 2026-08-13
**Author:** Builder session (architect: Nick)
**Purpose:** Answer two architect questions with citable evidence rather than assertion —
(1) *do agentic platforms work, and are they worth it?*
(2) *is the way we validate agents actually correct, and who validates the validator?*
**Standard applied:** [ADR-0009](../adr/0009-research-standards.md) source tiering + [LR-05](../constitution/local-rules.md#lr-05).

---

## 0. Read this first — the limits of this document

Two limitations are load-bearing. Both are stated up front because burying them would
reproduce exactly the failure mode this document is about.

### 0.1 Nothing here was fetched. Everything here was searched.

This session ran behind an egress proxy that blocks `arxiv.org`, `huggingface.co`,
`metr.org`, `api.openalex.org`, and every other scholarly host tried. Verified by direct
probe:

```
$ curl -sS "$HTTPS_PROXY/__agentproxy/status"     # proxy enabled, selective:false
$ WebFetch https://arxiv.org/abs/...              # EGRESS_BLOCKED
$ curl https://api.openalex.org/works?...         # CONNECT tunnel failed, response 403
```

So **no citation below was opened, read, and content-hashed.** Each is attested by a
search index that returned a title, a URL, and a snippet. That is a real evidentiary
step — it rules out an ID invented from nothing — but it is *weaker* than reading the
paper, and it cannot rule out a snippet that misstates the paper's actual finding.

This is not a footnote. The literature in §3 says LLM citation-hallucination rates run
**11–57%** in deployed models, and that agents routinely cite sources they never
verified. A document that cited that finding while itself passing along unread citations
would be self-refuting. Hence §1's verification ladder, and hence
[ADR-0060](../adr/0060-claim-provenance-verification.md), which makes the distinction
mechanical instead of a matter of good intentions.

**Every claim in this document is capped at `V1` verification.** Re-run
`node scripts/lib/claim-provenance.mjs --recheck research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`
from an unrestricted network to promote them.

### 0.2 The literature cannot answer "is Loom good." It can only answer "is Loom's bet the right bet."

No external source evaluates Loom. Every claim below is about *the class of system Loom
belongs to*. The step from "verification-first is the highest-leverage axis for agent
systems in general" to "Loom's verification layer delivers value" requires Loom's own
measurement, which is what [ADR-0054](../adr/0054-path-to-top-tier-proof-first.md)
Phase 1 exists to produce and what [ADR-0062](../adr/0062-governance-regression-gate.md)
keeps from rotting.

---

## 1. The verification ladder — how we decide whether information is good

The architect's question was *"how do we determine that the info is good?"* The answer
Loom needs is not a vibe but a **two-axis coordinate** on every claim: how good is the
source, and how hard did we actually check it?

Loom already had the first axis (ADR-0009 source tiers, T1–T5). It had no second axis —
which is why a hand-written `sources: [...]` array in a claim event was indistinguishable
from a verified one. This review introduces the second axis, and
[ADR-0060](../adr/0060-claim-provenance-verification.md) implements it.

### Axis A — source tier (existing, ADR-0009 / L7)

| Tier | Definition |
|---|---|
| **T1** | Peer-reviewed papers, official standards, official vendor docs, primary sources |
| **T2** | Established institutional / analyst reports with named editorial standards |
| **T3** | Reputable secondary press with editorial oversight |
| **T4** | Practitioner blogs, vendor marketing, newsletters — cited for convergence only |
| **T5 / Rejected** | Forums, UGC, social, undated + anonymous. Not admissible. |

### Axis B — verification level (new)

| Level | Meaning | How it is established |
|---|---|---|
| **V0** | Unverified | Asserted from model memory. No source resolved. |
| **V1** | Search-attested | A search index returned this title at this URL. Not opened. |
| **V2** | Fetched and read | Retrieved, and the quoted span content-hashed against the document. |
| **V3** | Independently corroborated | ≥2 sources with **independent error modes** reach the same conclusion. |
| **V4** | Replicated primary | Peer-reviewed replication, or a pre-registered RCT with published data. |

### The composition rule

> **A claim's confidence is capped by `min(tier, verification)`.**
> A T1 source at V0 buys nothing. A V3 corroboration of T4 sources buys convergence, not
> fact. `>95%` — the CLAUDE.md band that authorises autonomous execution — requires
> **T1–T2 at V2 or better**, or **V3 across independent T1–T3 lines**.

This is the rule that makes the calibration table in CLAUDE.md enforceable rather than
decorative, and it is what `scripts/lib/claim-provenance.mjs` computes.

### What "independent" has to mean

Independence is the whole ballgame, and it is easy to fake. Three sources are *not*
independent when:

- they cite each other, or all cite one common ancestor (a citation cascade);
- they are the same authors or the same lab under different titles;
- they are all vendor self-reports about their own product;
- they are all LLM-generated or LLM-judged with the **same** model family — the
  error-correlation trap Loom already names as `confabulation_consensus_suspected`
  ([ADR-0056](../adr/0056-multi-llm-deliberation-panel.md)).

Independence in this document means **different error modes**: an RCT and a survey and a
trace-annotation study can be wrong, but they cannot easily be wrong *the same way*.
Where I could not establish independence, the convergence claim is downgraded and said so.

---

## 2. Question 1 — do agentic platforms work, and are they worth it?

### 2.1 What I rejected, and why it matters

Searching for enterprise agent ROI returns a dense, confident, mutually-reinforcing
cluster of numbers: *"171% average ROI," "80% of firms report ROI," "88% of pilots never
reach production," "Forrester attributes 41% of failures to unclear success criteria,"
"$0.46 per contained ticket vs $4.18 human."*

Every one traces to content-marketing pages with **no named methodology, no sample, no
instrument, and no author**:
[agenticaiinstitute.org](https://agenticaiinstitute.org/enterprise-ai-agent-deployment-2026-roi-report/) ·
[digitalapplied.com](https://www.digitalapplied.com/blog/ai-agent-productivity-statistics-2026-roi-data-points) ·
[deployedlabs.com](https://www.deployedlabs.com/blog/ai-agents-business-results-and-real-roi-case-studies-for-2026) ·
[paul-okhrem.com](https://paul-okhrem.com/enterprise-ai-agents-statistics-2026/) ·
[lumichats.com](https://lumichats.com/blog/ai-agents-97-percent-deployed-11-percent-production-2026)

**Tier: T4/T5. Verdict: inadmissible under ADR-0009.** Note the specific trap — these
numbers *cross-cite each other*, so they present as V3 corroboration while actually being
one undocumented claim laundered through five hosts. That is the citation cascade in §1,
caught in the wild.

The finding worth keeping: **the searchable answer to "is agentic AI worth it" is almost
entirely uncitable.** Anyone who assembles a business case from page-one search results
is building on marketing copy. This is itself an argument for mechanical tiering.

### 2.2 Claim: for tasks with an objective verifier, agentic systems work. `[T1][V3]`

Four independent lines, four different methodologies:

| Line | Source | Independent because |
|---|---|---|
| RL with verifiable rewards trains reliably **only** where a binary verifier exists | DeepSeek-R1 / RLVR ([arXiv:2501.12948](https://arxiv.org/abs/2501.12948)); corroborated by [arXiv:2506.14245](https://arxiv.org/abs/2506.14245) on RLVR incentivising correct reasoning | Training-time evidence, different labs |
| **Process** supervision beats **outcome** supervision (78% vs 69% on MATH) | Lightman et al. ([arXiv:2305.20050](https://arxiv.org/pdf/2306.05685)); independently extended by automated process supervision ([arXiv:2406.06592](https://arxiv.org/html/2406.06592v1)) and process-supervised RL for code ([arXiv:2502.01715](https://arxiv.org/pdf/2502.01715)) | Different task domains (math, then code) |
| Bounded, well-specified agent domains reach ~61% pass@1 — and consistency, not capability, is the ceiling | τ-bench ([arXiv:2406.12045](https://arxiv.org/abs/2406.12045)) | Held-out benchmark, not a training result |
| Verifier-gated step-level supervision improves over ungated | [VeriGate, arXiv:2605.30451](https://arxiv.org/pdf/2605.30451) | Independent 2026 group |

**Convergence is strong and the mechanism is the same in all four:** a deterministic
check on the output is what converts a capable model into a reliable system. The
important corollary is the *negative* one — RLVR is explicitly out-of-scope for
non-verifiable domains **by design**. Anything Loom cannot write a verifier for is
outside the region where the evidence supports reliability. That is precisely why
[ADR-0044](../adr/0044-verifier-gates-for-agent-tasks.md)'s `verifier_type` is the right
primitive, and why §4.3's "declared but never resolved" gap was serious.

### 2.3 Claim: for open-ended expert work, the productivity gain is unproven — and one RCT says negative. `[T1][V1]`

The **only** randomised controlled trial on the question:
[METR, arXiv:2507.09089](https://arxiv.org/abs/2507.09089) —
16 experienced open-source developers, 246 real tasks in mature repos they averaged 5
years on. AI-allowed conditions took **19% longer**. Developers forecast **−24%** before,
and estimated **−20%** after. They were wrong about their own productivity by roughly 39
percentage points, in the flattering direction.
Secondary reporting: [The Register](https://www.theregister.com/2025/07/11/ai_code_tools_slow_down/).

**Honest caveats, which matter as much as the headline:** n=16; experts in codebases they
know deeply (the worst case for AI assistance); tooling was Cursor + Claude 3.5/3.7 in
early 2025, i.e. *pre*-agentic-harness. It does not generalise to "agents don't work." It
does establish something narrower and more durable:

> **Self-reported productivity is not evidence.** The one time anyone measured perception
> against a clock, perception was off by ~39 points.

This is the single most important citation in this document for Loom's purposes, because
it invalidates the cheapest possible answer to "did quality improve?" — asking. It is
also why [ADR-0062](../adr/0062-governance-regression-gate.md) makes the efficacy set a
*machine-run gate* rather than a periodic human impression.

### 2.4 Claim: AI adoption raises throughput and degrades stability, simultaneously. `[T2][V1]`

[DORA 2025 — State of AI-assisted Software Development](https://dora.dev/dora-report-2025/)
([Google Cloud](https://cloud.google.com/resources/content/2025-dora-ai-assisted-software-development-report)):
90% adoption; throughput now positively associated (**+2–18%**); **change failure rate
worsens**; instability concentrated where teams lack observability.

Large survey, correlational, self-reported — T2, not T1, and *not* independent of §2.3's
perception problem, since throughput is self-reported. But the directional finding is a
design constraint for Loom's own measurement:

> **A quality claim that reports only speed is not a quality claim.** Throughput and
> stability must be reported as a pair, because the best available evidence says AI moves
> them in opposite directions.

### 2.5 Claim: agent failures are governance failures, not capability failures. `[T1][V3]`

This is the most decision-relevant finding in the whole review.

**Primary:** Cemri et al., *Why Do Multi-Agent LLM Systems Fail?*
([arXiv:2503.13657](https://arxiv.org/abs/2503.13657)) — **NeurIPS 2025 Datasets &
Benchmarks track** ([proceedings](https://proceedings.neurips.cc/paper_files/paper/2025/hash/b1041e52d3be19f0a9bc491657488e4a-Abstract-Datasets_and_Benchmarks_Track.html) ·
[OpenReview](https://openreview.net/forum?id=fAjbYBmonr)). 1,600+ annotated execution
traces across 7 frameworks, 14 failure modes, inter-annotator **Cohen's κ = 0.88**:

| Category | Share | Loom's corresponding control |
|---|---|---|
| Specification & system design | **41.8%** | `requirements-analyst` + ADR-0046 register ([Upgrade 3](../adr/0061-requirements-register-role-and-verifier-fields.md)) |
| Inter-agent misalignment | **36.9%** | provenance graph, context admission check (ADR-0008) |
| Task verification & termination | **21.3%** — of which *incorrect* verification (9.1%) > *incomplete* (8.2%) | verifier gates (ADR-0044) + [ADR-0062](../adr/0062-governance-regression-gate.md) |

**Independent corroboration, different method:** the scaffold/harness survey
([arXiv:2503.16416](https://arxiv.org/abs/2503.16416), preprint) finds harness choice
causes **>30% performance variation on the same model** — attributing outcome variance to
the scaffold, not the weights. A third line, *Beyond the Leaderboard*
([arXiv:2607.05775](https://arxiv.org/pdf/2607.05775)), synthesises tool-use/planning
failures to the same place.

**Why this is V3 and not V1:** trace annotation, harness ablation, and failure synthesis
are three different instruments. They could each be wrong; they are unlikely to be wrong
identically.

**Consequence for Loom:** ~79% of observed multi-agent failure is specification +
coordination. That is Loom's declared axis
([ADR-0054](../adr/0054-path-to-top-tier-proof-first.md)). **The governance bet is
supported by the strongest available evidence** — not as a consolation for losing the
orchestration race, but because that is where the measured variance actually lives.

### 2.6 Claim: benchmark-based evidence has partially collapsed. Treat leaderboard numbers as suspect. `[T1][V1]`

- **OpenAI publicly retired SWE-bench Verified** for frontier reporting, citing
  contamination and flawed tests; a manual audit of 138 o3 failures found **59.4% were
  test flaws, not model limitations**
  ([OpenAI](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)).
- ~**32.7%** of successful patches involved solution leakage from issue text; corrected
  success for a representative SWE-agent configuration falls from ~**12.5% → ~4%**
  ([automated benchmark auditing, arXiv:2605.26079](https://arxiv.org/pdf/2605.26079);
  [contamination detection, arXiv:2603.21454](https://arxiv.org/pdf/2603.21454)).
- Models recall in-distribution file paths up to **76%** of the time vs **53%** for
  external files — a memorisation signature.

A vendor retiring the benchmark it was winning on is unusually credible evidence: the
incentive runs the other way.

**Consequence for Loom:** any Loom metric built on a public benchmark inherits this rot.
Loom's own efficacy harness is *better positioned* than most published work precisely
because it is a **closed, deterministic, self-authored** scenario set with no training
exposure — but only if it is protected against the same drift, which is
[ADR-0062](../adr/0062-governance-regression-gate.md)'s job, and only if it is honest that
a 19-scenario set is a floor, not a benchmark.

### 2.7 Bottom line on Question 1

| Question | Answer | Confidence |
|---|---|---|
| Do agentic systems work? | **Yes, where a verifier exists.** Unproven-to-negative on open-ended expert work. | `[T1][V3]` for the verifiable half; `[T1][V1]` for the negative half |
| Are they worth it? | **Conditionally, and the condition is measurement.** No credible general ROI evidence exists; the credible micro-evidence is mixed. | `[T1–T2][V1]` |
| Is Loom's axis the right one? | **Yes.** ~79% of multi-agent failure is specification + coordination; harness choice moves outcomes >30%. | `[T1][V3]` |
| Does Loom's governance deliver? | **Unproven externally; measured internally only at the enforcement layer** (+11/11 safety catches, 0% false positive, $0). Live-agent A/B outstanding. | `[internal][V2]` |

**What would raise the last row to >95%:** the ADR-0054 Phase-1a live-agent A/B — a fixed
golden task set, run governed vs ungoverned, pre-registered outcomes, with throughput and
stability reported as a pair per §2.4.

---

## 3. Question 2 — is *our way of validating* correct? And who validates the validator?

The architect asked for the validation method itself to be cited, not just asserted. Each
subsection below states a method Loom now uses, then the independent lines supporting it.

### 3.1 Method: a validator is validated against a human gold set, with chance-corrected agreement. `[T1][V3]`

**Never against another agent.** Three independent lines:

1. **Reliability ≠ validity.** *Reliability without Validity: A Systematic, Large-Scale
   Evaluation of LLM-as-a-Judge Across Agreement, Consistency, and Bias*
   ([arXiv:2606.19544](https://arxiv.org/html/2606.19544v1)) — judges can be highly
   self-consistent **and systematically wrong**. Consistency is not correctness.
   Corroborated from the opposite direction by *Rating Roulette: Self-Inconsistency in
   LLM-As-A-Judge* ([arXiv:2510.27106](https://arxiv.org/pdf/2510.27106)) and *The Coin
   Flip Judge?* ([arXiv:2606.13685](https://arxiv.org/pdf/2606.13685)).
2. **Chance-corrected statistics are the standard, with published thresholds.**
   *Agreement Measurement for Rubric-based LLM Judges: What to Report and Why*
   ([arXiv:2606.00093](https://arxiv.org/html/2606.00093)) — report weighted κ or rank
   correlation for ordinal scales, **Krippendorff's α** with multiple raters/missingness;
   **α ≥ 0.80** for high-confidence use, **0.67–0.80** tentative. This is not new
   methodology borrowed from AI; it is the long-standing content-analysis standard
   (Krippendorff; Landis & Koch cut-offs), independently documented in the
   methodological literature
   ([PMC4974794](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4974794/) ·
   [k-alpha.org methodological notes](https://www.k-alpha.org/methodological-notes)).
   **Independence note:** the AI-specific paper and the 40-year-old statistics literature
   are genuinely independent lines — the second cannot have been written to support the first.
3. **Judges are biased in known, measured directions.** Position bias worth **10–15
   points of win-rate swing** by slot order, plus verbosity and self-enhancement bias
   (Zheng et al., MT-Bench/Chatbot Arena,
   [arXiv:2306.05685](https://arxiv.org/pdf/2306.05685), **NeurIPS 2023**
   [poster](https://neurips.cc/virtual/2023/poster/73434) ·
   [ACM](https://dl.acm.org/doi/10.5555/3666122.3668142)). **Self-preference** is
   linearly correlated with a model's ability to recognise its own output
   (Panickssery & Bowman,
   [arXiv:2404.13076](https://arxiv.org/pdf/2404.13076) ·
   [Semantic Scholar](https://www.semanticscholar.org/paper/LLM-Evaluators-Recognize-and-Favor-Their-Own-Panickssery-Bowman/5c7f465d162aade4a4c0eefb02fd7aadeebdaf58)),
   independently replicated in
   [arXiv:2410.21819](https://arxiv.org/pdf/2410.21819) and
   [arXiv:2509.03647](https://arxiv.org/pdf/2509.03647).

**Directly on point for the Critic:** *Can LLM-as-a-Judge Reliably Verify Rubrics in
Agentic Scenarios?* / RuVerBench
([arXiv:2606.29920](https://arxiv.org/abs/2606.29920v1)) — 2,458 instances, deep-research
and agentic-coding domains. That is the Critic's exact job description, benchmarked.

**Verdict on Loom's prior practice:** partially correct, materially incomplete.
ADR-0056 already refuses to treat agent unanimity as evidence and caps it as
`confabulation_consensus_suspected` — that instinct is **confirmed** by lines 1 and 3.
But Loom had **no gold set and no κ anywhere in the repo**, so the Critic's accuracy was
never measured. Named as an open gap in
[ADR-0059](../adr/0059-skill-adherence-and-session-compliance.md) §Deferred and tracked
as the next validation milestone.

### 3.2 Method: validate the validator by seeding known defects it must catch. `[T1][V3]`

This is the answer to *"who validates the validators?"* for the deterministic layer, and
it is not an AI technique at all — it is **mutation testing**, a 45-year-old software
engineering method with a mature empirical literature.

- **Foundational survey:** Jia & Harman, *An Analysis and Survey of the Development of
  Mutation Testing*, IEEE TSE 37(5):649–678, 2010
  ([PDF](https://web.eecs.umich.edu/~weimerw/2022-481F/readings/mutation-testing.pdf) ·
  [Semantic Scholar](https://www.semanticscholar.org/paper/An-Analysis-and-Survey-of-the-Development-of-Jia-Harman/d7c38286734419b52de4262c9802ebdfcf4b9447)).
  The core idea is exactly what Loom needs: *a checker's adequacy is measured by its
  ability to detect small artificial faults deliberately seeded into the thing it checks.*
- **Independent industrial validation at scale:** *Practical Mutation Testing at Scale: A
  View from Google*, IEEE TSE 2021
  ([Google Research](https://research.google/pubs/practical-mutation-testing-at-scale-a-view-from-google/) ·
  [arXiv:2102.11378](https://arxiv.org/pdf/2102.11378) ·
  [ACM](https://dl.acm.org/doi/10.1109/TSE.2021.3107634)) — deployed across **>24,000
  developers on >1,000 projects**, with the key practical lesson Loom should copy:
  mutate **only changed code**, filter irrelevant mutants, cap mutants per line.
- **Independence:** a 2010 academic survey and a 2021 industrial deployment study at a
  different organisation, on different codebases, with different incentives.

**Applied to Loom:** the governed-vs-ungoverned efficacy set is a *test suite for the
governance layer*. Its adequacy is therefore measurable the same way — seed unsafe
commands the classifier **should** catch and assert it does.
[ADR-0062](../adr/0062-governance-regression-gate.md) implements this as
`--mutate`, and the Google finding is why it runs on the diff in CI rather than sweeping
everything every time.

Note the pleasing property: this makes the validator-validation **deterministic and $0**.
No judge, no κ, no human in the loop for the part that can be mechanised. Reserve the
expensive human gold set for the part that genuinely cannot.

### 3.3 Method: measure discipline adherence mechanically, because it decays silently. `[T1][V3]`

Loom's recurring failure across AnonForum and Ravenwise was **silent degradation** —
agents stop being invoked, hooks go dark, and nothing announces it
([ADR-0054](../adr/0054-path-to-top-tier-proof-first.md) context). The literature says
this is not a Loom defect but a property of the medium:

1. **Instruction adherence decays monotonically with turn count.** *When Attention
   Closes: How LLMs Lose the Thread in Multi-Turn Interaction*
   ([arXiv:2605.12922](https://arxiv.org/html/2605.12922)) — even strong reasoning models
   drop from ~88% to ~71% adherence between first and third turn; "instruction
   forgetting." Corroborated by *Models Recall What They Violate: Constraint Adherence in
   Multi-Turn LLM Ideation* ([arXiv:2604.28031](https://arxiv.org/pdf/2604.28031)) and
   *Quantifying Laziness, Decoding Suboptimality, and Context Degradation*
   ([arXiv:2512.20662](https://arxiv.org/pdf/2512.20662)).
2. **Configuration-file instructions are not reliably followed.** *Instruction Adherence
   in Coding Agent Configuration Files: A Factorial Study of Four File-Structure
   Variables* ([arXiv:2605.10039](https://arxiv.org/pdf/2605.10039)) — directly about
   CLAUDE.md-shaped files. **This is the paper that says a governance rule written in
   CLAUDE.md is not a governance rule.**
3. **Cause is structural, not motivational** — context dilution and sliding-window
   exclusion, not any instruction to forget.

**Verdict:** writing the discipline down cannot enforce the discipline, and *no amount of
prompt quality fixes this*. Adherence must be **measured from the event log** and
**enforced by code outside the model's context**. That is the entire justification for
[ADR-0059](../adr/0059-skill-adherence-and-session-compliance.md) — and it converges with
ADR-0044's existing five-source finding that verification infrastructure beats elaborate
instructions.

### 3.4 Method: provenance must be resolved mechanically, never self-reported. `[T1][V3]`

Four independent lines, spanning three professional domains:

1. **General deployed-model rates:** citation hallucination **11–57%** across
   commercially deployed models; up to ~70% in the worst reported settings
   ([citation grounding, arXiv:2606.00898](https://arxiv.org/pdf/2606.00898) ·
   [CiteCheck, arXiv:2605.27700](https://arxiv.org/html/2605.27700v1)).
2. **Agents cite what they did not read** — *Cited but Not Verified: Parsing and
   Evaluating Source Attribution in LLM Deep Research Agents*
   ([arXiv:2605.06635](https://arxiv.org/html/2605.06635v1)). This is the exact failure
   mode of a `sources: [...]` array an agent fills in from memory.
3. **Automatic attribution checking is itself hard** — AttributionBench: even a
   fine-tuned model reaches only ~80% macro-F1; CiteME: LLMs identify the correct paper
   to cite **4–18%** of the time; retrieval-aware CiteGuard reaches 68%. So a *judge*
   cannot be the citation checker either — you need **retrieval + deterministic ID
   resolution** (DOI/CrossRef/title lookup), which is what CiteCheck does.
4. **Independent domain replication with legal consequences:** Dahl, Magesh, Suzgun & Ho,
   *Large Legal Fictions*, **Journal of Legal Analysis**
   ([arXiv:2401.01301](https://arxiv.org/abs/2401.01301) ·
   [Stanford RegLab](https://reglab.stanford.edu/publications/hlarge-legal-fictions-profiling-legal-hallucinations-in-large-language-models/) ·
   [JLA PDF](https://dho.stanford.edu/wp-content/uploads/Hallucinations_JLA.pdf) ·
   [replication repo](https://github.com/reglab/legal_hallucinations)) —
   **>800,000 verifiable questions**; hallucination **58% (GPT-4) to 88% (Llama 2)**; and
   critically, *models struggle to predict their own hallucinations.*

**That last clause is the decisive one.** A model cannot self-assess its citation
accuracy, so asking it to tag its own confidence in a source is structurally unreliable.
Provenance has to be resolved by code. Peer-reviewed law-journal publication plus a
public replication repo makes line 4 the strongest single citation in this document.

**Verdict on Loom's prior practice:** the claim convention captured the *right fields*
(`sources`, `confidence`, `what_would_raise_to_95`) and validated **none** of them.
[ADR-0060](../adr/0060-claim-provenance-verification.md) closes this: resolve each source,
record `resolved | unreachable | unresolvable`, classify its tier, and **cap confidence at
`min(tier, verification)`** per §1.

### 3.5 Method: pre-register the outcome before running the comparison. `[T1][V1]`

Justified by §2.3's perception gap (predicted −24%, estimated −20%, actual +19%) and by
§2.6's benchmark rot: post-hoc metric selection on a contaminated set produces whatever
number you hoped for. Loom's efficacy scenarios carry `class` and `expected` **in the
fixture file**, committed before the run — this is already pre-registration by
construction, and [ADR-0062](../adr/0062-governance-regression-gate.md) freezes the
threshold in the repo so it cannot be relaxed silently to make a run pass.

### 3.6 The grading rubric

Two levels, because the work and its grader need separate scorecards.

**Level 1 — work quality.** Four of six axes are mechanical; only two need judgment.

| Axis | Measurement | Type | Source |
|---|---|---|---|
| Correctness | `npm test` / eval suite passes | `test_suite` | ADR-0044 |
| Requirement coverage | % register rows with a passing case | `schema_check` | ADR-0046 |
| Safety | catch rate on the labelled scenario set | `test_suite` | ADR-0062 |
| Discipline adherence | matched ÷ (matched + unmatched) from the event log | `schema_check` | ADR-0059 |
| Cost | tokens per completed task | `surrogate` | LR-06 |
| Rework / escape rate | edits to the same file within N days; defects found after "done" | `surrogate` | DORA §2.4 pairing |

**Level 2 — grader quality (the meta-rubric).**

| Axis | Measurement | Threshold | Source |
|---|---|---|---|
| Agreement with human gold set | weighted κ / Krippendorff α | **α ≥ 0.80**; 0.67–0.80 tentative | §3.1 |
| Seeded-defect sensitivity | % of injected known-unsafe ops caught | **100%** on the frozen set | §3.2 |
| False-positive rate | % safe ops flagged | **0%** — friction destroys the signal | ADR-0047 |
| Bias | position / verbosity / self-preference swing | measured, reported | §3.1 line 3 |
| Drift | all of the above, re-measured over time | no regression | §3.3 |

**The honest gap:** Loom can now measure every Level-1 axis and Level-2's rows 2–3
mechanically. Rows 1 and 4 need a human-labelled gold set that does not exist yet. That
is the next milestone, and it is named as such rather than quietly omitted.

---

## 4. What this review changed

| Finding | Change |
|---|---|
| Config-file instructions are not reliably followed (§3.3) | Adherence measured from the event log, not asserted in CLAUDE.md — [ADR-0059](../adr/0059-skill-adherence-and-session-compliance.md) |
| Models cannot predict their own hallucinations (§3.4) | Provenance resolved by code; confidence capped at `min(tier, verification)` — [ADR-0060](../adr/0060-claim-provenance-verification.md) |
| 41.8% of multi-agent failure is specification/design (§2.5) | `requirements-analyst` installed; register gains `Owner Role` + `Verifier` — [ADR-0061](../adr/0061-requirements-register-role-and-verifier-fields.md) |
| Validators are validated by seeded defects (§3.2) | Efficacy set promoted to a CI regression gate with `--mutate` — [ADR-0062](../adr/0062-governance-regression-gate.md) |
| Verification is a *level*, not a boolean (§0.1, §1) | V0–V4 ladder added; this document's own claims capped at V1 |
| Benchmarks rot; vendors retire them (§2.6) | Loom's closed scenario set is an asset — but must be frozen and diff-gated |
| No gold set, no κ anywhere in Loom (§3.1) | Named as the next validation milestone, not silently skipped |

---

## 5. What would change these conclusions

- **§2.2 flips** if RLVR-style reliability were demonstrated in a genuinely
  non-verifiable domain. Nothing suggests this.
- **§2.3 flips** on a larger RCT with current agentic harnesses showing positive effect
  for experts. This is the single most valuable missing study in the field; METR's n=16
  and pre-agentic tooling make it eminently supersedable under LR-05.
- **§2.5 flips** if a replication of Cemri et al. on modern frameworks found failures had
  migrated from specification to capability. Worth re-checking annually.
- **§3.1–3.4 flip** only on evidence that mechanical verification adds cost without
  reliability gain. ADR-0044 already names this as its own falsifier and none has appeared
  in five independent corroborations plus the four lines added here.
- **This whole document is upgradeable from V1 to V2** by re-running the provenance
  resolver from an unrestricted network. Until then, treat §2 and §3 as
  *well-corroborated but unread*.

---

## Appendix — full source register with tier and verification

| # | Source | Tier | Verif. | Used for |
|---|---|---|---|---|
| 1 | METR RCT, [arXiv:2507.09089](https://arxiv.org/abs/2507.09089) | T1 | V1 | §2.3 perception gap |
| 2 | Cemri et al. MAST, [arXiv:2503.13657](https://arxiv.org/abs/2503.13657), NeurIPS 2025 | T1 | V1 | §2.5 failure taxonomy |
| 3 | Lightman et al., [arXiv:2305.20050](https://arxiv.org/pdf/2306.05685) | T1 | V1 | §2.2 process supervision |
| 4 | DeepSeek-R1 RLVR, [arXiv:2501.12948](https://arxiv.org/abs/2501.12948) | T1 | V1 | §2.2 verifiable rewards |
| 5 | τ-bench, [arXiv:2406.12045](https://arxiv.org/abs/2406.12045) | T1 | V1 | §2.2 consistency ceiling |
| 6 | Scaffold survey, [arXiv:2503.16416](https://arxiv.org/abs/2503.16416) | T1 (preprint) | V1 | §2.5 harness variance |
| 7 | OpenAI SWE-bench retirement | T1 (vendor primary) | V1 | §2.6 benchmark rot |
| 8 | Benchmark auditing, [arXiv:2605.26079](https://arxiv.org/pdf/2605.26079) | T1 | V1 | §2.6 leakage |
| 9 | DORA 2025, [dora.dev](https://dora.dev/dora-report-2025/) | T2 | V1 | §2.4 throughput/stability |
| 10 | Reliability without Validity, [arXiv:2606.19544](https://arxiv.org/html/2606.19544v1) | T1 | V1 | §3.1 judge validity |
| 11 | Agreement measurement, [arXiv:2606.00093](https://arxiv.org/html/2606.00093) | T1 | V1 | §3.1 κ / α thresholds |
| 12 | RuVerBench, [arXiv:2606.29920](https://arxiv.org/abs/2606.29920v1) | T1 | V1 | §3.1 rubric verification |
| 13 | Zheng et al. MT-Bench, [arXiv:2306.05685](https://arxiv.org/pdf/2306.05685), NeurIPS 2023 | T1 | V1 | §3.1 judge bias |
| 14 | Panickssery & Bowman, [arXiv:2404.13076](https://arxiv.org/pdf/2404.13076) | T1 | V1 | §3.1 self-preference |
| 15 | Jia & Harman, IEEE TSE 2010 | T1 | V1 | §3.2 mutation testing |
| 16 | Mutation testing at Google, IEEE TSE 2021 | T1 | V1 | §3.2 industrial scale |
| 17 | When Attention Closes, [arXiv:2605.12922](https://arxiv.org/html/2605.12922) | T1 | V1 | §3.3 adherence decay |
| 18 | Config-file adherence, [arXiv:2605.10039](https://arxiv.org/pdf/2605.10039) | T1 | V1 | §3.3 CLAUDE.md limits |
| 19 | Cited but Not Verified, [arXiv:2605.06635](https://arxiv.org/html/2605.06635v1) | T1 | V1 | §3.4 unread citations |
| 20 | Dahl et al., *Large Legal Fictions*, J. Legal Analysis | T1 (peer-reviewed + repo) | V1 | §3.4 self-blindness |
| 21 | Krippendorff α methodology, [PMC4974794](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4974794/) | T1 | V1 | §3.1 statistics standard |
| — | ROI marketing cluster (5 hosts, §2.1) | **T4/T5** | — | **Rejected — inadmissible** |

*Sources 1–21 are search-attested (V1). None was fetched; see §0.1.*
