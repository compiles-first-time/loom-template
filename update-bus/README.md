# Update Bus

> Semi-automatic update queue. Candidate updates flow in; human approval is required for every merge.

---

## Layout

```
update-bus/
├── inbox/      # Candidate updates pending review
└── archive/    # Resolved updates (approved + rejected, with reason)
```

## Flow

```
[External feed] | [project lesson] | [internal audit]
        ↓
    inbox/<id>.md
        ↓
  Critic review → reject? → archive/rejected/<id>.md (with reason)
        ↓ approve
  Human Replica preview → recommendation appended
        ↓
  User approval queue (in chat)
        ↓ approve
  ADR written → spec file(s) updated → archive/applied/<id>.md
        ↓ optional
  Propagation to other Loom projects (opt-in per project)
```

## Candidate file format

```markdown
---
id: <unique-id>
source: research-feed | project-lesson | internal-audit
proposed_by: <agent or human>
date: YYYY-MM-DD
affects: [list of files or layers]
risk: low | medium | high
collapse_risk: false  # true if the change would affect evaluation or governance
---

# <Short title>

## Proposed change
<one paragraph>

## Motivation
<why now, why this, what evidence>

## Affected files
- <path>
- <path>

## Critic review
<filled in by Critic>

## Human Replica recommendation
<filled in by Human Replica>

## User decision
<filled in by user; approve | reject | defer>
```

## Anti-collapse rules

Per [§B.8 of the spec](../spec/loom-spec-v0.1-full.md):

- Updates with `collapse_risk: true` cannot be auto-merged regardless of approvals
- A new eval may **only add alongside** existing evals, never replace
- Kernel Rule 1–8 amendments require explicit override-authority sign-off
- Kernel cannot grade itself — Constitution Service never approves its own kernel updates
