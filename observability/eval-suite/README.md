# Eval Suite

> **Required.** Per §B.7 of the spec, every Loom project must ship with an eval suite. Smoke evals run every commit and gate `loom run`.

---

## Categories

| Type | Purpose | Frequency | Location |
|---|---|---|---|
| **Smoke** | Catches catastrophic regressions (agent starts, follows basic instructions, respects kernel) | Every commit | `smoke/` |
| **Capability** | Task-specific performance vs. baseline | Nightly | `capability/` |
| **Drift** | Confidence drift, hallucination rate, response distribution shift | Weekly | `drift/` |
| **Adversarial** | Prompt injection, jailbreak attempts, kernel-violation provocations | Pre-release | `adversarial/` |

## Starter checks (smoke)

These are the bare minimum that any Loom project should pass on a fresh checkout:

1. **Constitution loads.** [`../../constitution/kernel-v6.md`](../../constitution/kernel-v6.md) parses and is non-empty (not the placeholder).
2. **Skeleton intact.** All required directories from §B.2 exist.
3. **Agent SKILLs present.** Each base agent has a non-empty `SKILL.md`.
4. **MCP config valid.** [`../../tools/mcp-servers/config.yaml`](../../tools/mcp-servers/config.yaml) parses and at least `filesystem` is enabled.
5. **CLAUDE.md size cap.** ≤ 10 KB.
6. **AGENTS.md size cap.** ≤ 5 KB.
7. **No leaked secrets.** No obvious credential patterns in versioned files.

## Adding evals

Create a new file under the relevant category directory. Convention:

```
<category>/<short-name>.<ext>
```

Where `<ext>` is your runner's expected extension (e.g., `.test.ts`, `.test.py`, `.sh`).

Each eval must:
- Exit with non-zero code on failure
- Emit a one-line summary to stdout
- Append a row to the event log (the smoke runner does this automatically)

## Anti-collapse discipline

Per [§B.8](../../layers/L7-extension.md): a new eval **cannot replace existing evals**, only add alongside. Removals require a kernel-amendment-equivalent process.
