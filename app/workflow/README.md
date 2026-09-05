# /app/workflow — the dashboard

**Both core features live on this screen.** F1 renders the branching workflow; F2 runs
verification inside it. This is the demo.

## F1 — the branching graph

React Flow canvas, auto-laid-out with dagre or elkjs. Derived from `Requirement.depends_on`
edges via [`engines/graph.ts`](../../engines/graph.ts) — **never a hand-written node list.**

| Node state | Meaning |
|---|---|
| `locked` | Upstream dependency incomplete |
| `available` | Ready to work, nothing uploaded |
| `in_progress` | Some inputs present |
| `verified` | All inputs present and all checks passed — **green check** |
| `defect` | A check failed |

**`defect` outranks `verified`.** A node with every input present but a contradiction must not
render as done.

Critical path nodes are visually distinguished from slack nodes. The projected earliest-filing
date is the most valuable number on the screen — keep it visible and let it tighten as nodes
complete.

## The node panel

Opens on click:

- Required inputs, each with satisfied/unsatisfied state
- **The governing citation, displayed** — this is the credibility claim, not a footnote
- Verification status, and an unverified badge when `verified: false`
- Upload control
- Defects, each naming both conflicting sources with page and field

## F2 — the verification loop

```
upload → extract → ontologize → check → green check | defect
```

1. Caseworker uploads a document to a node
2. [`extraction/pipeline.ts`](../../extraction/pipeline.ts) reads it into typed facts with page-and-field provenance
3. Facts are written to the case with provenance
4. `ConsistencyRule`s touching those facts run deterministically
5. Pass → node goes green, downstream unlocks, graph recomputes.
   Fail → node goes to `defect` with both sources named.

**Recompute the whole graph after any verification.** Completing a node changes durations and
can move the critical path; patching one node's state locally drifts out of sync with the
projected date.

### UI requirements for the AI call

Extraction is a multi-second call. Show per-stage progress — `reading → extracting →
checking → done`. A spinner with no stages reads as a hang, and it will hang on conference
wifi at least once during rehearsal.

## Tone of a defect

A defect is a question, not an accusation: *"the address on the 2024 tax return (p. 1) differs
from the home study address (p. 3) — which is current?"* rather than *"error: address
mismatch."*

Caseworkers are the users, but the subject is a real family. The system reports that two
papers disagree. It never infers what that disagreement means about the family.
(Hard boundary #1.)

## What green never means

A green check means **this document is consistent and complete.** It does not mean approved,
cleared, or assessed. Label it as document status everywhere it appears.
