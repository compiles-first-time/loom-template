# L7 — Self-Extension & Living-Update Mechanism (Loom Update Bus)

> **Canonical source:** §B.8 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).
> **Failure mode this layer guards against:** Silent drift in what the system thinks is "good."

---

## Purpose

Make Loom **living software** without enabling silent self-modification. Every update flows through a human approval gate.

## The Update Bus pipeline

```
[External research feed]──┐
[Project lessons-learned]─┼──▶ inbox/ ──▶ Critic review ──▶ Human Replica preview ──▶ User approval
[Internal pattern audit] ─┘                                                                  │
                                                                                              ├── Approve ──▶ ADR + spec update ──▶ optional propagation to other projects
                                                                                              └── Reject  ──▶ archive/ with reason
```

## The three update sources

| Source | What flows in | Frequency |
|---|---|---|
| External research feeds | Papers, frameworks, MCP servers, model releases, benchmark results | Weekly poll (configurable) |
| Cross-project lessons-learned | Promoted lessons from other Loom projects | Per lesson |
| Internal pattern audits | Critic/Auditor proposes refinements | Monthly |

Locations:
- Pending: [`../update-bus/inbox/`](../update-bus/inbox/)
- Resolved: [`../update-bus/archive/`](../update-bus/archive/)

## How this respects Kernel Rule 19

| Rule 19 requirement | Update Bus implementation |
|---|---|
| Transparent and auditable | Every proposed update is an ADR; every approval/rejection logged |
| Consent from affected agents | Human Replica previews on behalf of user; user approves before merge |
| Foundational rules (1–8) effectively immutable | Updates to kernel rules 1–8 require explicit override-authority signature, not just user approval |
| Updates that would violate kernel cannot be adopted | Constitution Service validates every update before queuing |

## Collapse-prevention discipline

`[LLM-A][H]` Updates that affect the system's own evaluation or governance **cannot be auto-merged**:

- A new eval cannot replace existing evals — only add alongside
- A new agent capability cannot be deployed without passing the existing eval suite
- The kernel cannot grade itself

## Apply flow

When the user accepts an update:

1. Write an ADR in [`../adr/`](../adr/)
2. Update the relevant spec file
3. **Optionally** propagate to other Loom projects (opt-in per project)
4. Append to [`../memory/event-log/`](../memory/event-log/)

---

## Open work for this layer

- [ ] Configure research feed sources (RSS / arXiv / GitHub releases)
- [ ] Define monthly internal-audit cadence for the Critic
- [ ] Decide cross-project propagation policy for this project
