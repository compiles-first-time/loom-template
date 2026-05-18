# ADR-0003: Retrieval pipeline — hybrid retrieve → rerank → assemble

**Status:** Accepted
**Date:** 2026-05-18
**Author:** Architect handoff (Phase 1 research) — approved by Nick
**Confidence:** [H]

## Context

`layers/L3-memory.md` named five memory subsystems (markdown, vector index, KG, event log, skill library) and specified persistence guarantees and event-log retention, but it did **not** specify a retrieval pipeline. "Retrieve from the vector index" was a placeholder, not a design. Every Loom project would have to re-improvise retrieval at first use.

Phase 1 retrieval-and-context-engineering research surfaces five load-bearing findings:

1. **Hybrid retrieval is the production default.** Dense vector search combined with sparse BM25, fused with Reciprocal Rank Fusion, beats either alone. Pure vector search is not the default. `[research-p1][H]` citing Cormack et al., SIGIR 2009 (RRF).
2. **Cross-encoder reranking is the single highest-impact component.** `[research-p1][H]` citing Santhanam et al., ColBERTv2, NAACL 2022.
3. **Chunk size dominates chunk strategy.** ~200–400-token recursive chunks measurably outperform the common ~800-token default. `[research-p1][H]` citing Chroma chunking evaluation, 2024.
4. **A stronger semantic retriever is NOT strictly better.** Semantically-similar-but-irrelevant passages hurt accuracy more than random text — a reranker is the mitigation. `[research-p1][H]` citing Cuconasu et al., SIGIR 2024 ("Power of Noise").
5. **Changing the embedding model forces a full re-embed.** Matryoshka-trained embeddings allow dimension truncation without re-embedding. `[research-p1][H]` citing Kusupati et al., NeurIPS 2022.

Without an explicit pipeline, the "Power of Noise" finding is the silent failure mode: a strong embedding model with no reranker can produce *worse* retrieval than no retrieval at all.

## Decision

L3 specifies an explicit **`retrieve → rerank → assemble`** pipeline as the project-agnostic default, with chunking and embedding-model discipline baked in.

- **Retrieve:** hybrid — dense vector + sparse BM25, fused via Reciprocal Rank Fusion. Pure vector search is not the default.
- **Rerank:** cross-encoder reranker over the top-k fused candidates. Dense retrieval is **not** deployed without a reranker.
- **Assemble:** highest-ranked items at the start and end of context, never buried in the middle; assembled set respects the requesting agent's context budget (see ADR-0004).
- **Chunking:** recursive split, target 200–400 tokens, small overlap. The ~800-token default is rejected.
- **Embedding model:** one model per project, documented; prefer a Matryoshka-capable model for dimension flexibility.

## Consequences

**Locks in:**
- Every Loom project must stand up dense + sparse retrieval and a reranker, not just a vector store.
- An embedding-model commitment is now a project-level decision recorded at bootstrap.
- Chunk-size discipline is enforced (200–400 tokens; not 800).

**Locks out:**
- "Just stuff the index, query top-k, return" pure-vector pipelines.
- Switching embedding models casually — the full-re-embed cost is now documented up front.

**Migration path if it fails:** the pipeline is composable; any stage (retrieve, rerank, assemble) can be swapped without redesigning L3. If a project lacks compute for a cross-encoder, a lighter reranker (e.g., a small bi-encoder reranker or LLM-as-reranker) is acceptable as a documented downgrade.

## Alternatives considered

- **Vector-only retrieval** — rejected: distractor risk per "Power of Noise"; reranker is the mitigation; hybrid retrieval is the production default.
- **BM25-only retrieval** — rejected: misses semantic paraphrase coverage.
- **Defer the decision to each project** — rejected: every project would re-improvise; that is exactly what Loom exists to prevent.

## References

- [`../layers/L3-memory.md`](../layers/L3-memory.md) — Retrieval pipeline section
- [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md) §B.4
- ADR-0004 (context budget) — assembly stage must respect it
- `[research-p1][H]` Phase 1 retrieval & context-engineering research synthesis
