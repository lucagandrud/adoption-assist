# /engines — the product

Deterministic engines over one ontology. The dashboard is the surface; **the engines are the
product.**

| File | Role | Feature | Phase | Priority |
|---|---|---|---|---|
| [`graph.ts`](graph.ts) | Workflow DAG + critical path | **F1** | 7–17 | ⭐ never cut |
| [`consistency.ts`](consistency.ts) | Cross-document verification | **F2** | 17–21 | ⭐ never cut |
| [`delta.ts`](delta.ts) | State-pair resolution | supports F1 | 7–12 | view deferred |
| [`validity.ts`](validity.ts) | Expiration math | supports F2 | 17–21 | view deferred |

## On the two "deferred" engines

Deferred means **the standalone UI is cut, not the logic.**

- **`delta.ts`** — F1 cannot compose a workflow without resolving which requirements apply to
  a given state pair and direction. That resolution is this file. The separate CA↔TX
  *comparison screen* is the stretch goal.
- **`validity.ts`** — F2 flags a clearance that expires before the projected decision date,
  which needs this date arithmetic. The dedicated *180-day timeline view* is the stretch goal.

Build the logic on schedule. Skip the screens if time runs short.

## Rules for everything in this directory

**1. Deterministic. No LLM in this path.**
Consistency checks, date arithmetic, and critical path are comparison and arithmetic. AI is
used for document extraction only. Do not put an LLM in the decision path where arithmetic
will do.

This is a demo position as much as a correctness one: deterministic engines produce identical
output every run, so the demo cannot surprise you on stage.

**2. No state logic in code.**
Nothing here may branch on `"CA"` or `"TX"`. Thresholds, validity periods, occupancy limits,
and tolerances come from the ontology. The test: adding a 51st jurisdiction should require
zero changes in this directory.

**3. Provenance survives every transformation.**
An engine that produces a finding it cannot source has produced nothing usable. Every defect
names both conflicting documents with page and field.

**4. No substantive assessment.**
These engines check completeness, consistency, validity, and sequencing. They never judge
whether a family is fit. A passing check means the paperwork is consistent — nothing more.
(Hard boundary #1.)

## Current state

All four files are commented pseudocode marked `PSEUDOCODE — NOT IMPLEMENTED`, carrying the
algorithm sketch, output shapes, and the open design questions worth settling before writing
code.
