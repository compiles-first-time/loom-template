# L6 — Observability & Evaluation

> **Canonical source:** §B.7 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).
> **Why this layer matters:** It is the single biggest defense against silent drift, hallucination, and the information-theoretic collapse problem.

---

## Stack (all self-hosted, $0)

| Component | Tool | Config |
|---|---|---|
| Tracing | Langfuse (self-hosted) | [`../observability/langfuse-config.yaml`](../observability/langfuse-config.yaml) |
| Metrics | Prometheus + Grafana | TBD |
| Logs | Local filesystem + rotation | OS-default |
| Alerting | Grafana alerts or ntfy.sh | TBD |
| OTel GenAI semantic conventions | OTLP exporter → Langfuse | per Langfuse config |

OTel GenAI alignment satisfies Kernel Rules 22–23 simultaneously.

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

Every agent action emits a record like:

```json
{
  "timestamp": "<iso>",
  "agent": "<name>",
  "project": "<project>",
  "action": "<action>",
  "confidence": 0.87,
  "what_would_raise_to_95": "<answer>",
  "sources": ["<source-id>", "..."],
  "decision_log": ["<consideration>", "..."],
  "constitutional_check": "Passed Rule N, Rule M",
  "kernel_version": "v6"
}
```

**Non-optional.** Agents that don't emit this format are not Loom-compliant.

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

- [ ] Stand up local Langfuse (Docker compose recommended)
- [ ] Wire OTel GenAI exporter on all agents
- [ ] Implement smoke eval suite (must pass before `loom run`)
- [ ] Define alert routing (email? ntfy? Slack?)
- [ ] Author the retrieval golden set + nightly RAGAS-style runner per [ADR-0006](../adr/0006-retrieval-evaluation.md)
- [ ] Wire faithfulness drift as the primary drift signal on the dashboard
