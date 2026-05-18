# ADR-0001: Loom v0.1 scaffold

**Status:** Accepted
**Date:** 2026-05-14
**Author:** Loom template
**Confidence:** [H]

## Context

A new project is being bootstrapped from the Loom Architectural Base Spec Template. We need an explicit record of which version of Loom this project was instantiated from, so that future Update Bus propagation can compute deltas.

## Decision

This project is instantiated from **Loom v0.2.0** (originally v0.1; v0.2 adds the enforcement runtime per [ADR-0011](./0011-claude-code-enforcement-runtime.md) without changing the v0.1 architectural conclusions), paired with **Kernel V6**.

## Consequences

- Future updates flowing through the Update Bus are computed against the v0.2.0 baseline
- The canonical spec lives at [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md); v0.2 amendments are tracked in Part J of that file. The v0.1 architectural conclusions remain intact — v0.2 is additive runtime, not a re-synthesis
- When Loom v0.3 ships, a fresh upgrade ADR will document the deltas

## Alternatives considered

- *Not version-pinning* — rejected because Update Bus propagation depends on knowing the baseline
- *Version-pinning each layer independently* — rejected as premature complexity

## References

- [`../README.md`](../README.md) (template root)
- [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md) §B.8 (Update Bus)
- [`../layers/L7-extension.md`](../layers/L7-extension.md)
