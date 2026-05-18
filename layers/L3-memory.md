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

## Retrieval pipeline

> **Canonical default per [ADR-0003](../adr/0003-retrieval-pipeline.md).** "Retrieve from the vector index" is not a design; this is. Every project gets this pipeline by default.

| Stage | What happens | Why this, not the alternative |
|---|---|---|
| **Retrieve** | Hybrid: dense vector search + sparse BM25, fused via Reciprocal Rank Fusion `[research-p1][H]` | Pure vector search is not the production default; hybrid + RRF (Cormack et al., SIGIR 2009) beats either alone |
| **Rerank** | Cross-encoder reranker over the top-k fused candidates `[research-p1][H]` | Single highest-impact component in benchmarks (Santhanam et al., ColBERTv2, NAACL 2022). A stronger semantic retriever is **not** strictly better — semantically-similar-but-irrelevant passages hurt accuracy more than random text (Cuconasu et al., SIGIR 2024, "Power of Noise"). The reranker is the mitigation |
| **Assemble** | Highest-ranked items at the **start and end** of context, never buried in the middle; result must fit the requesting agent's [context budget](./L2-agents.md#context-budget) | Lost-in-the-middle is a positional U-shape at any context length, not a 32K cliff. See [ADR-0004](../adr/0004-context-budget.md) for the budget |

**Non-negotiables:**

- **Dense retrieval is not deployed without a reranker.** The distractor caveat above is the reason.
- **Chunking:** recursive split, target **200–400 tokens**, small overlap. Do not adopt the common ~800-token default. `[research-p1][H]` Chroma chunking evaluation, 2024 — chunk *size* dominates chunk *strategy*.
- **Embedding model:** commit to **one** embedding model per project; changing it forces a full re-embed of the corpus. Prefer a Matryoshka-trained model for dimension flexibility without re-embed `[research-p1][H]` (Kusupati et al., NeurIPS 2022).

## Trust boundary

> **Canonical default per [ADR-0007](../adr/0007-content-trust-boundary.md).**

Retrieved or externally-ingested content (web search, tool output, third-party feeds) is **untrusted** until validated. Content entering the vector index or knowledge graph from external sources is **quarantined / flagged** until it passes the validation gate; tier metadata is recorded with each record. Memory poisoning is a real, cheap attack — `[research-p1][H]` PoisonedRAG (Zou et al., USENIX Security 2025) reached ~90% attack success by injecting ~5 malicious documents into a million-document store. The Update Bus source-tiering filter ([L7](./L7-extension.md#source-tiering)) is the project-wide implementation.

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
- [ ] Stand up hybrid retrieval (dense + BM25 + RRF) per [ADR-0003](../adr/0003-retrieval-pipeline.md)
- [ ] Wire a cross-encoder reranker over the top-k fused candidates
- [ ] Configure recursive chunker at 200–400 tokens (not 800)
- [ ] Commit to one embedding model and record the choice in an ADR; prefer a Matryoshka-capable model
- [ ] Implement the trust-boundary quarantine for externally-ingested content per [ADR-0007](../adr/0007-content-trust-boundary.md)
