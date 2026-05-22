# L4 — Tooling Layer

> **Canonical source:** §B.5 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).

---

## Four-protocol stack

| Protocol | Purpose | Loom priority |
|---|---|---|
| **MCP** (Model Context Protocol) | Tool/data access | **v1 — required** |
| **A2A** (Agent-to-Agent) | Delegation between autonomous agents | v2 — defer until multi-process |
| **ACP** (Agent Communication Protocol) | Lightweight REST-based agent messaging | v2 — defer until in-process IPC is a bottleneck |
| **UCP** (Universal Commerce Protocol) | Agent-to-agent payments | v3 — defer |

`[base][H]` MCP is genuinely production-grade. Other protocols carry weaker evidence; see [§E.3 of the spec](../spec/loom-spec-v0.1-full.md).

## MCP server roster

Configured in [`../tools/mcp-servers/config.yaml`](../tools/mcp-servers/config.yaml). Default Loom set:

| Server | Purpose | Required? |
|---|---|---|
| filesystem | Read/write project files | Yes |
| git | Repository operations | Yes |
| web-search | Web research | Yes |
| database | Project state DB ops | Yes |
| chat-gateway | Telegram/Slack/Signal user interface | Yes |
| github | Code review, issue tracking | Recommended |
| project-specific | Figma, Stripe, Salesforce, etc. | As needed |

## Orchestration framework selection

| Framework | Verdict |
|---|---|
| **LangGraph.js** | **v1 default** — most established TS option |
| Mastra | Watch — promising but immature |
| OpenAI Agents SDK TS | Avoid as primary — vendor-locked |

This decision is itself an ADR. Revisable; see [`../adr/0002-orchestration-framework.md`](../adr/0002-orchestration-framework.md).

## LLM provider routing

> Model identifiers below are **role-based**, not version-pinned. Concrete model strings (`claude-...`, `gpt-...`, `gemini-...`) are stale within months and must be validated at `loom init` time, not hardcoded in the spec.

| Role | Provider | Use case |
|---|---|---|
| Frontier reasoning model | Anthropic (Claude family) | Default — complex tasks, coding, document synthesis |
| Fallback reasoning model | OpenAI | When the primary provider is rate-limited or unavailable |
| Long-context model | Google (Gemini family) | Long-context — **but see the effective-context caveat below** |
| Local model | Open-weights, consumer GPU (Llama / Qwen family) | Embeddings, guardrails, sensitive data |

**Effective-context caveat `[research-p1][H]` (per [ADR-0005](../adr/0005-effective-context-routing.md)):** advertised context windows are **not** effective windows. Effective length can be 1–2 orders of magnitude smaller on hard retrieval (NoLiMa, Modarressi et al., ICML 2025 — e.g., a 200K-window model reliably retrieves only ~4K tokens on lexical-overlap-free tasks; a 2M-window model only ~2K). The earlier "Gemini degrades ~800K" claim from a podcast was imprecise and is superseded by this finding.

**Routing rule:** if a task's required context exceeds the effective budget for the chosen model, route it through the L3 retrieval pipeline (chunk → retrieve → rerank → assemble, [ADR-0003](../adr/0003-retrieval-pipeline.md)). **Do not** "solve" oversized context by selecting a larger-window model — that is the silent-failure path.

**Critical:** All routing decisions logged. No model grades its own output (information-theoretic collapse — `[LLM-A][H]`).

## MCP-over-CLI for credentialed services

> Per [LR-03](../constitution/local-rules.md#lr-03-secrets-must-not-appear-in-chat-input-or-tool-output) / [ADR-0018](../adr/0018-secrets-handling.md).

When a service offers both a CLI and an MCP server (Supabase, Vercel, GitHub, Linear, Slack, etc.), **prefer the MCP server**. The credential lives in MCP config (env var or secrets-manager reference) and never reaches the tool args captured in the event log. A CLI invocation like `supabase --service-key=eyJ...` leaks the credential into `memory/event-log/YYYY-MM-DD.jsonl` even with the v0.3 redaction layer (high-confidence patterns are redacted, but novel token shapes can slip through).

Concrete guidance:

| Service | Prefer | Avoid |
|---|---|---|
| Supabase | `mcp__supabase__*` tools | `supabase --service-key=...` on the CLI |
| Vercel | `mcp__vercel__*` tools | `vercel --token=...` on the CLI |
| GitHub | `mcp__github__*` tools | `gh` with `GH_TOKEN` inlined in the command |
| Linear, Slack, etc. | corresponding MCP server | CLI with inline credentials |

This is **not** a ban on CLIs — they're fine when no MCP server exists, or when the CLI reads its credential from an env var sourced outside the chat (`.env`, OS keyring, secrets manager). The rule is: **the credential value must not appear in a tool call's args**.

---

## Open work for this layer

- [ ] Populate [`../tools/mcp-servers/config.yaml`](../tools/mcp-servers/config.yaml) for this project
- [ ] Confirm orchestration framework choice in [`../adr/0002-orchestration-framework.md`](../adr/0002-orchestration-framework.md)
- [ ] Set provider API keys via env vars (never commit secrets)
- [ ] Validate concrete model identifiers (Claude / GPT / Gemini / local) against current vendor catalogs at `loom init`; do not rely on the role-based names above as version strings
- [ ] Record per-model effective-context multipliers used by the router (per [ADR-0005](../adr/0005-effective-context-routing.md))
