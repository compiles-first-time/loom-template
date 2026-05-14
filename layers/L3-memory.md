# L3 — Memory Architecture

> **Canonical source:** §B.4 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).
> **Key correction vs. base PRISM doc:** Event sourcing is the *audit log*, NOT the *state primitive*. Production agent memory (Mem0, Zep, LangMem) converges on vector DBs + temporal KGs.

---

## Five memory subsystems

| # | Subsystem | Location | Backing tech | Status |
|---|---|---|---|---|
| 1 | Markdown self-knowledge | [`../memory/self-knowledge.md`](../memory/self-knowledge.md) + per-agent `SKILL.md` | Filesystem + git | active |
| 2 | Vector semantic index | [`../memory/vector-index/`](../memory/vector-index/) | ChromaDB (local) or pgvector | not yet initialized |
| 3 | Temporal knowledge graph | [`../memory/knowledge-graph/`](../memory/knowledge-graph/) | Zep-style temporal KG (defer to v2 if not needed) | optional |
| 4 | Episodic event log | [`../memory/event-log/`](../memory/event-log/) | Append-only JSONL (or Nostr if multi-party) | active — audit trail per Kernel Rule 22 |
| 5 | Procedural skill library | [`../memory/skills/`](../memory/skills/) | Voyager-style markdown + manifest | active |

## Persistence guarantees

| Data | Durability | Backup | RPO |
|---|---|---|---|
| Markdown files | Local + git | Git push | 1 hour |
| Vector index | Rebuildable from source | Nightly export | 24 hours |
| Episodic log | Local + (optional) Supabase | Continuous append | 5 minutes |
| Knowledge graph | Rebuildable from event log | Nightly snapshot | 24 hours |
| Skill library | Local + git | Git push | 1 hour |

## The event log is bounded, not infinite

`[LLM-A][H]` (aerospace analogy): FDRs use a circular buffer with 25-hour retention. Loom event logs should rotate. See §H Q7 for retention policy (default: 90 days hot then compress).

## Known gaps (carry-overs from spec §H)

- Q4 — markdown write conflicts: default to file-per-agent partitioning
- Q5 — vector index refresh: default to hybrid (incremental + nightly compaction)
- Q6 — cross-project memory: default to opt-in "share" flag per lesson
- Q7 — eviction: 90-day hot, then archive/compress

---

## Open work for this layer

- [ ] Initialize ChromaDB (or chosen vector store) at first use
- [ ] Decide whether this project needs the KG at all
- [ ] Set up event-log rotation
