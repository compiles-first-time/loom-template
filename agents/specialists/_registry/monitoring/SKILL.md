---
name: monitoring
summary: Uptime + APM + RUM — Better Stack, Datadog, Vercel Analytics, OpenTelemetry. Distinct from error-tracking; this covers performance + availability.
tier: bundled
context_budget: 16000
tools: [Read, Glob, Grep, Edit, Write]
---

# monitoring specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md).

## Role + scope

Performance + availability monitoring: uptime probes, APM (request traces, slow-query detection), RUM (Core Web Vitals, real-user latency), dashboard setup, on-call alert routing. Distinct from `error-tracking` (which handles exceptions).

When to invoke: prompts about "uptime", "latency", "APM", "Core Web Vitals", "Datadog", "Better Stack", "Grafana", "OpenTelemetry", "tracing".

## Tool scope

- Read / Glob / Grep across whole repo.
- Edit / Write scoped to `lib/monitoring/**`, `instrumentation.ts`, alert config files, dashboards-as-code.

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MON-EX-01 | BE | Configure | Alert thresholds set so tight that pager fires hourly | Alert config | Config review | Threshold values | `mon.alert_storm_risk` event | Numbers | Recommendation | Recommend SLO-based alerting (burn-rate thresholds) over raw threshold alerting; surface Google SRE workbook ch.5 reference | Alert fatigue is the #1 cause of on-call burnout (Google SRE workbook ch.5). Burn-rate alerts on a stated SLO are the documented antidote |
| MON-EX-02 | SE | Configure | OTel collector unreachable | Collector | Network | OTel spans | `mon.collector_unreachable` event | gRPC / HTTP | Network error | Drop spans (do NOT block the app's hot path on telemetry); emit `mon.spans_dropped` metric locally for retrospective tuning | Telemetry must not affect application latency. Drop-on-failure with local accounting is the OpenTelemetry "data quality" guidance |
| MON-EX-03 | BE | Configure | RUM enabled without consent gating in a GDPR-relevant region | RUM SDK | Config review | SDK init + region | `mon.rum_consent_missing` event | Config | Boolean | Refuse to ship; require consent-mode integration or region-conditional disable | RUM SDKs typically set cookies and capture user behavior; this is regulated by ePrivacy Directive in the EU/UK. Shipping without consent is a regulatory liability |

## Decline triggers

- **Self-hosted observability stack design** → escalate to EAC; v0.4 covers SaaS providers + OTel-to-vendor.

## Evidence basis

- **Primary:** OpenTelemetry specification (otel.io). `[institutional][H]`
- **Corroborating:**
  - Google SRE Workbook ch. 5 (Alerting on SLOs). `[institutional][H]`
  - Vendor docs (Datadog, Better Stack, Vercel Analytics, Grafana Cloud). `[vendor][H]`
- **What would change this call:** OTel spec major version breaking change.

## Runtime counterpart

[`../../../../.claude/agents/monitoring.md`](../../../../.claude/agents/monitoring.md).
