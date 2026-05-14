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

| Provider | Use case |
|---|---|
| Anthropic (Claude 4.6/4.7 Sonnet, Opus) | Default — complex tasks |
| OpenAI (GPT-4o, o3-mini) | Fallback when Claude unavailable |
| Google (Gemini 1.5/2.0 Pro) | Long-context (note: Gemini degrades ~800K tokens `[transcript][H]`) |
| Local (Llama 3, Qwen 14B+) | Embeddings, guardrails, sensitive data |

**Critical:** All routing decisions logged. No model grades its own output (information-theoretic collapse — `[LLM-A][H]`).

---

## Open work for this layer

- [ ] Populate [`../tools/mcp-servers/config.yaml`](../tools/mcp-servers/config.yaml) for this project
- [ ] Confirm orchestration framework choice in [`../adr/0002-orchestration-framework.md`](../adr/0002-orchestration-framework.md)
- [ ] Set provider API keys via env vars (never commit secrets)
