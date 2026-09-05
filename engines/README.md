# /engines — the product

Four deterministic engines over one ontology. The portal is the surface; **the engines are
the product.**

| File | Engine | Deliverable | Phase | Cut order |
|---|---|---|---|---|
| [`consistency.ts`](consistency.ts) | Cross-document consistency | D1 | 6–10 | ⭐ never cut |
| [`validity.ts`](validity.ts) | Validity clocks vs. 180-day window | D2 | 6–10 | — |
| [`graph.ts`](graph.ts) | DAG + critical path | D3 | 10–16 | ⭐ never cut |
| [`delta.ts`](delta.ts) | State-pair requirements delta | D4 | 16–19 | cut #2 |

## Rules for everything in this directory

**1. Deterministic. No LLM in this path.**
Consistency rules, validity math, and critical path are arithmetic and comparison. AI is
used for extraction and the interview only. Do not put an LLM in the decision path where
arithmetic will do. (CLAUDE.md principle #3.)

This is not only a correctness position — it is a demo position. Deterministic engines
produce the same output every run, which means the demo cannot surprise you on stage.

**2. No state logic in code.**
Nothing in this directory may branch on `"CA"` or `"TX"`. Thresholds, validity periods,
occupancy limits, and tolerances all come from the ontology. If you find yourself writing
`if (state === "TX")`, the value belongs in `/ontology` instead.

The test: adding a 51st jurisdiction should require zero changes here.

**3. Provenance survives every transformation.**
An engine that produces a finding without being able to name its sources has produced
nothing usable. Engine 1 defects name both conflicting documents with page and field.

**4. No substantive assessment.**
These engines check completeness, consistency, validity, and sequencing. They never judge
whether a family is fit. (Hard boundary #1.)

## Current state

All four files are commented pseudocode marked `PSEUDOCODE — NOT IMPLEMENTED`. They contain
the algorithm sketch, the output shapes, and the open design questions worth settling before
writing code.
