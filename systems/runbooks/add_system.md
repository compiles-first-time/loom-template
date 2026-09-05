# rb_add_system — Add a new system or part to the atlas

## Runbook

| Field | Value |
|---|---|
| Trigger | Work reveals a system the registry does not have: a new part of an existing system, a new mechanism, or something the Director asked for that the spec does not name. |
| Primary | systems_atlas |
| Roles | orchestrator; director |
| Director | Yes when the system is not in the spec: it enters as `candidate` and stays unbuilt until a spec PR says otherwise (§14). `implied` needs no decision but must cite the section that needs it. |
| Spec | §4 R9 small diffs, §14 change control, ADR-0065, ADR-0066 |
| Not touched | — |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | systems_atlas | systems/llm/nodes.jsonl | `scripts/systems-map.sh find <words>` shows no existing node for the concept | Prefer sharpening an existing summary over a near-duplicate node. |
| 2 | decide | — | GAME_INFRA_SPEC.md | status: `spec` (a section defines it), `implied` (a section needs it — cite it), or `candidate` (DIRECTOR decision pending) | Never `spec` without a section. |
| 3 | update | systems_atlas | systems/registry/<domain>.md | `scripts/systems-map.sh add-node --id <id> --name "…" --parent <parent> --phase <n> --status <s> --owner <role> --where <path> --spec "§x" --summary "…"` | Ids are snake_case and permanent; tier is parent tier + 1; owner is a §7.1 role that may write the Where path. |
| 4 | update | systems_atlas | systems/registry/<domain>.md | one `add-edge` per dependency: written from the dependent's view (From depends on To) except emits; how ∈ the 12-word vocabulary; strength hard or soft; a Why that a reviewer can check | An edge without a Why is refused. |
| 5 | check | event_bus | systems/registry/00-foundation.md | if the system emits or listens, the `sig_*` node exists (else `rb_add_signal`) | — |
| 6 | run | systems_atlas | systems/ | `scripts/systems-map.sh validate` — zero errors; read the warnings (phase inversion, scope leak, R2 smell, runbook coverage) | A warning is a design question, answer it in the PR. |
| 7 | check | systems_atlas | systems/runbooks/ | does an existing runbook now have a new direct hard downstream? validate names it; add a step or a "Not touched" reason | — |
| 8 | run | systems_atlas | systems/ | `scripts/systems-map.sh render` — ATLAS.md, atlas/, explorer.html, llm/ regenerated | The doctor fails on stale generated files. |
| 9 | run | loom_doctor_gate | . | `bash scripts/doctor.sh` green | — |
| 10 | check | harness_adapters | CLAUDE.md | the adapters' atlas facts (domain count, open questions, ritual commands) are still true | CLAUDE.md quotes the atlas; a new domain or a resolved question changes it. |
| 11 | update | changelog | docs/changelog.md | one line: the system, its status, its parent | — |
