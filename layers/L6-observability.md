# L6 — Observability & Evaluation

> **Canonical source:** §B.7 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).
> **Why this layer matters:** It is the single biggest defense against silent drift, hallucination, and the information-theoretic collapse problem.

---

## Stack

| Component | Tool | Status in v0.2 | Config |
|---|---|---|---|
| **Event log (primary, v0.2)** | Append-only JSONL via Claude Code hooks | **Ships** — see [ADR-0011](../adr/0011-claude-code-enforcement-runtime.md) | [`../.claude/settings.json`](../.claude/settings.json) + [`../scripts/hooks/`](../scripts/hooks/) |
| Tracing | Langfuse (self-hosted) | **Documented integration target** — not shipped by the template | [`../observability/langfuse-config.yaml`](../observability/langfuse-config.yaml) |
| Metrics | Prometheus + Grafana | Integration target | TBD |
| Logs | Local filesystem + rotation | Filesystem ships; rotation per L3 (90-day hot) | OS-default |
| Alerting | Grafana alerts or ntfy.sh | Integration target | TBD |
| OTel GenAI semantic conventions | OTLP exporter → Langfuse | Integration target | per Langfuse config |

OTel GenAI alignment satisfies Kernel Rules 22–23 simultaneously. v0.2 ships the JSONL event log as the **primary observability artifact**; Langfuse / OTel are honest integration targets, not shipped infrastructure. Don't promise what we don't deliver.

## Dashboard signals

| Signal | Threshold | Action |
|---|---|---|
| Agent heartbeat | > 60s silent | Restart agent |
| LLM cost | > $5/hr | Alert user |
| Task latency | > 4h pending | Escalate |
| Error rate | > 10% failed/total | Review + alert |
| Memory growth | > 100 KB per markdown file | Archive + compress |
| Faithfulness drift (primary) | Declining trend against the fixed golden set (RAGAS-style faithfulness/groundedness) | Investigate; pause auto-merges via the Update Bus until cleared `[research-p1][H]` (per [ADR-0006](../adr/0006-retrieval-evaluation.md)) |
| Confidence drift (secondary) | Declining average self-reported confidence | Weak signal; investigate if corroborated by faithfulness drift — self-reported confidence is unreliable on its own (Kadavath et al.) `[research-p1][H]` |

## Epistemic transparency record (Kernel Rule 22)

> **v0.2 runtime split, per [ADR-0011](../adr/0011-claude-code-enforcement-runtime.md).** The v0.1 spec listed a single record schema and called it "non-optional." In practice, the schema has two emitters with two different capabilities. The split below is honest about that.

### Mechanical fields — hook-emitted, on every action

A `PreToolUse` / `PostToolUse` hook sees the tool name and arg payload. It does **not** see the model's reasoning. So these fields are always-on, auto-emitted by [`../scripts/hooks/`](../scripts/hooks/) to `memory/event-log/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "<iso>",
  "session_id": "<claude-code-session-id>",
  "cwd": "<project-root>",
  "event_type": "session_start | tool_call | tool_result | destructive_op | session_end | claim",
  "tool": "<tool-name>",
  "tool_args_summary": { "...": "redacted + truncated" },
  "exit_code": null,
  "error_signature": "<sha1-prefix>",
  "kernel_version": "v6",
  "loom_version": "0.2.0"
}
```

### Introspective fields — LLM-emitted by convention, on non-trivial claims

`confidence`, `what_would_raise_to_95`, `decision_log`, and `constitutional_check` require model introspection. They are emitted by the model as `event_type: claim` records, per the **Claim convention** in [`../CLAUDE.md`](../CLAUDE.md):

```json
{
  "timestamp": "<iso>",
  "session_id": "<...>",
  "event_type": "claim",
  "agent": "<acting-agent-or-session>",
  "claim": "<the assertion>",
  "confidence": 0.87,
  "what_would_raise_to_95": "<answer>",
  "sources": ["<source-id>", "..."],
  "decision_log": ["<consideration>", "..."],
  "constitutional_check": "Passed Rule N, Rule M"
}
```

The combined log satisfies Rule 22 in spirit (every action has provenance; every non-trivial claim has confidence) while being honest about what each emitter can actually fill.

**Non-optional.** Projects whose hooks don't emit the mechanical subset are not Loom v0.2 compliant.

## Eval harness

Lives in [`../observability/eval-suite/`](../observability/eval-suite/). Required types:

| Type | Frequency |
|---|---|
| Smoke evals | Every commit |
| Capability evals | Nightly |
| Drift evals | Weekly |
| Adversarial evals (prompt injection, jailbreak, kernel-violation provocations) | Pre-release |
| **Retrieval evals** (faithfulness / groundedness, retrieval recall, retrieval precision against a fixed golden set) `[research-p1][H]` per [ADR-0006](../adr/0006-retrieval-evaluation.md) | Nightly |

Loom ships a starter set; projects extend.

---

## Open work for this layer

- [x] Ship the JSONL event log via Claude Code hooks (v0.2, [ADR-0011](../adr/0011-claude-code-enforcement-runtime.md))
- [ ] Stand up local Langfuse (Docker compose recommended) — integration target, opt-in per project
- [ ] Wire OTel GenAI exporter on all agents — integration target
- [ ] Implement smoke eval suite (must pass before `loom run`)
- [ ] Define alert routing (email? ntfy? Slack?)
- [ ] Author the retrieval golden set + nightly RAGAS-style runner per [ADR-0006](../adr/0006-retrieval-evaluation.md)
- [ ] Wire faithfulness drift as the primary drift signal on the dashboard
- [ ] Wire the Claim convention into agent prompts so introspective `event_type: claim` records are actually emitted on non-trivial claims
