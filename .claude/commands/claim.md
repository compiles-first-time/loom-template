Emit a **Rule-22 claim event** with its provenance mechanically resolved, per [ADR-0060](../../adr/0060-claim-provenance-verification.md). Use this instead of hand-writing JSONL with `echo` — that friction is why the introspective half of the audit trail kept going dark.

## Input

`$ARGUMENTS` — the assertion to record. If empty, ask what claim to log.

## Why this exists

The claim convention has always asked for `confidence` and `sources`. Nothing checked either. A hand-typed `sources: [...]` array was indistinguishable from a verified one, so Rule 22's provenance requirement was satisfiable by typing.

That matters because the evidence says self-reported citation is structurally unreliable: hallucination rates of **11–57%** across deployed models, deep-research agents citing sources they never opened, and — decisively — models "struggle to predict their own hallucinations" (Dahl et al., *Large Legal Fictions*, J. Legal Analysis, >800k questions). **You cannot self-assess your own citation accuracy.** So the sources get resolved by code, not by your judgment about them.

## What to do

**Step 1 — State the claim in one falsifiable sentence.** If it cannot be wrong, it is not a claim; it is a description. Rewrite it.

**Step 2 — List the sources.** Any of these forms resolve:

| Form | Example | Resolves against |
|---|---|---|
| Repo path | `layers/L6-observability.md` | the file, in-repo (Tier 1) |
| Path + anchor / line | `scripts/lib/doctor.mjs:588` | the file |
| ADR number | `ADR-0044` | `adr/0044-*.md` |
| Local rule | `LR-06` | `constitution/local-rules.md` |
| Requirement | `BR_13` | its register |
| arXiv id | `arXiv:2503.13657` | `https://arxiv.org/abs/…` (network) |
| DOI | `doi:10.1109/TSE.2021.3107634` | `https://doi.org/…` (network) |
| URL | `https://dora.dev/dora-report-2025/` | the URL (network) |

**Prefer a quoted span.** Passing the exact sentence you are relying on promotes that source from `V1` (it exists) to `V2` (it says what you claim), and records a content hash. A source that exists but does not contain the span is reported as **unresolvable — the citation misrepresents the source**, which is a worse defect than a missing file and must never read as success.

**Step 3 — Resolve the provenance.**

```bash
node scripts/lib/claim-provenance.mjs ADR-0044 LR-06 "arXiv:2503.13657"
# add --online to actually check remote sources
```

Read the three-state output honestly:

- **`resolved`** — the referent provably exists.
- **`unreachable`** — could not check (offline, blocked proxy, timeout). **Not a failure.** An egress-blocked network is an environment fact, not a discipline lapse. Say so and move on.
- **`unresolvable`** — checked, and it is not there. **This is a defect.** Fix the citation or drop the claim; never leave it.

**Step 4 — Respect the confidence cap.** The tool prints the maximum confidence your provenance can support: `min(source tier, verification level)`, taking your strongest source, with a bump to `0.95` when two *independent* sources resolve (different kinds, or different hosts — two arXiv URLs are one line of evidence, not two).

> **Do not state a confidence above the cap.** If you believe the claim more strongly than the cap allows, that belief is not yet evidence — record the lower number and put what you'd need in `what_would_raise_to_95`.

**Step 5 — Append the event.** One JSONL line to `memory/event-log/YYYY-MM-DD.jsonl`:

```json
{"timestamp":"<iso>","session_id":"<id>","event_type":"claim","agent":"<name-or-session>","claim":"<assertion>","confidence":0.80,"confidence_cap":0.80,"what_would_raise_to_95":"<answer>","sources":["ADR-0044","LR-06"],"decision_log":["<reason>"],"constitutional_check":"Passed Rule 22"}
```

Then append the matching `claim_provenance_result` record so the session compliance verdict ([ADR-0059](../../adr/0059-skill-adherence-and-session-compliance.md)) can see that the claim was checked. A claim with **no** provenance record is flagged as unverified — being unchecked is its own failure state, distinct from being checked and clean.

**Step 6 — Answer the standing question.** `what_would_raise_to_95` is mandatory and must name a *specific, obtainable* piece of evidence — a measurement to run, a document to fetch, a source to read. "More research" is not an answer.

## Verifier

`verifier_type: schema_check + exit_code` — the record must carry all claim-convention fields, and `claim-provenance.mjs` must exit 0 (no unresolvable sources).

## Boundaries

- **Never invent a source to satisfy the checker.** An honest `V0` claim at 0.60 confidence is worth more than a fabricated `V2` at 0.95, and the fabrication is the exact failure this skill exists to prevent.
- **`unreachable` is not `unresolvable`.** Do not "fix" a blocked network by deleting the citation.
- **Do not raise a stated confidence to match a hoped-for cap.** The cap constrains the claim; the claim does not license the cap.
