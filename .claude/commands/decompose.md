Turn an approved **requirements register into a dispatchable task graph** — the plan artifact for the gated pipeline (explore → plan → **approve** → execute → verify), per [ADR-0064](../../adr/0064-decompose-gated-pipeline.md). Use when a register is mechanically complete and the next question is *who builds each piece, how is each piece proven, and which specialist doesn't exist yet.*

## Input

`$ARGUMENTS` — a register id (`BR_NN`) or path. If empty, ask which register to decompose.

## Proportionality — check this FIRST

If the change can be described in one sentence, **skip this entirely and execute directly.** The decomposer flags registers with ≤1 solution step as `direct_execution_advised`. A planning ceremony applied to a typo fix is how disciplines get disabled; the discipline exists for changes that are uncertain, touch multiple files, or need specialists.

## What to do

**Step 1 — Run the decomposer.** It is deterministic; do not hand-build the graph.

```bash
node scripts/lib/decompose.mjs BR_NN
```

Every `BR`, solution step, and `TR` becomes a node carrying its `Owner Role`, `Verifier`, and **context packet** (the node's register rows + attached exceptions — the pruned slice a specialist gets, never the whole conversation). `TR` rows surface as **prerequisites**: what no agent can clear goes in front of a person *before* dispatch.

**Step 2 — Resolve what the graph reports, in this order:**

1. **Unowned / unverified nodes** → back to the register (or `/testcase`). A node with no owner is a step nobody is dispatched for; a node with no verifier cannot be closed (ADR-0044). Do not fill these in yourself — they are register defects.
2. **Specialist gaps** — the chameleon trigger. An `Owner Role` matching no installed agent, registry specialist, or known runtime/human role means the capability doesn't exist yet. Hand each gap to the **EAC**, which applies its embed-vs-split rule (extend an existing specialist when the capability is tightly coupled; synthesize a new one when it is reusable and independent), authors it to the ADR-0063 skill standard, registers it through HR, and caches it in the registry. `specialist_gap` events are already in the log.
3. **Prerequisites** → surface the blocking list to the requester now.

**Step 3 — Save the plan and get approval.** Write the rendered plan to `orchestration/plans/<BR_NN>-plan.md`. **The file is what gets approved — trust the file, not the chat.** What an agent says in conversation and what lands in the plan are not always the same thing; review and approval happen on the artifact.

**Step 4 — Execute with context hygiene.** Implementation starts in a **fresh session** loaded with only the approved plan file plus each node's context packet as it's dispatched. The exploration and debate that produced the plan compete for attention against the plan itself — leave them behind. Dispatch per node to its `Owner Role`; each node closes only when its named `Verifier` resolves (record it: `node scripts/lib/verify-gate.mjs <agent> <pass|fail> "<task>"`).

**Step 5 — Verify with the running system, not vibes.** A green test suite doesn't prove the app boots. The `BR` node's own verifier is the final gate, and for anything user-facing that means exercising the real behavior.

## Verifier

`verifier_type: schema_check + human_gate` — the graph must come from the decomposer (deterministic), and the plan file must be approved by the requester before execution.

## Boundaries

- **Decomposition quality is bounded by register quality.** Garbage in, garbage flowing through every dispatched node — that is why the Requirements Analyst gates upstream, and why register defects go back to the register instead of being patched in the plan.
- **Do not invent owners or verifiers.** Reporting them missing is the job.
- **Do not spawn specialists yourself.** Gaps route through the EAC → HR path; that gate is what keeps synthesized capability reviewed (ADR-0063 §vetting, ADR-0030).
