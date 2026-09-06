# /ontology — the product

**Start here.** The ontology is the long pole and the thing that cannot be compressed.
If the graph is beautiful and the requirement data is thin, we lose.

Everything else in the system operates on this data. Only ontology data is state-specific
— **there is no state logic anywhere in code.** Adding a 51st jurisdiction must mean adding
a directory here and nothing else.

## Layout

```
/shared      Federal ICPC requirements, canonical fact types, and actions.
             Anything true regardless of state goes here.
/ca          California. Resource Family Approval (RFA) — a unified process.
/tx          Texas. DFPS home screening and licensing.
schema.ts    Zod schemas for all four object types. Validated at boot.
```

CA and TX are in scope in **both directions** — CA sending → TX receiving, and TX sending →
CA receiving. A `Requirement` carries a `direction` field for exactly this reason.

## The four object types

| Type | What it is |
|---|---|
| `Fact` | A canonical typed value extracted from a document |
| `Document` | An artifact in the case file |
| `Requirement` | An obligation imposed by a state or by the compact |
| `ConsistencyRule` | An assertion that must hold across facts |
| `Action` | A verb — a state transition a caseworker can invoke |

`Action` is what makes this an ontology rather than a schema. `verify`, `flag`, `override`,
`request_renewal`, and `mark_filed` are typed operations with preconditions and recorded
effects, so an override becomes an audited event with an author rather than a silently
flipped boolean.

Full field lists are in [`schema.ts`](schema.ts) and in [`CLAUDE.md §6.1`](../CLAUDE.md).

## Rules for authoring ontology data

**1. Every `Requirement` and `Document` carries `source_citation` and `verified`.**
The UI displays the citation. This is what separates this project from a checklist app.

**2. Unsourced means `verified: false`.** If you cannot point at an actual CA or TX state
document, the entry is marked `"verified": false` and the UI surfaces it as unverified.
Do not guess a plausible-looking statute number — a fabricated citation is worse than no
citation, and fabricated regulatory content is the single fastest way to lose this.

**3. Do not hand-author the dependency graph.** Set `depends_on` edges on each
`Requirement`. Engine 3 derives the DAG from those edges. If you find yourself writing a
node list, stop.

**4. `external_turnaround_days` is not optional on anything with a wait.** Fingerprint
processing, agency scheduling, lab turnaround. This field drives the critical path — a
requirement with a missing turnaround silently corrupts the earliest-submission-date
computation.

**5. `validity_period_days` is state-specific.** The same document type can expire on a
different clock in CA than in TX. That difference is a real finding and Engine 4 should
surface it.

## Recording sources

Every citation you add here gets a corresponding row in [`docs/SOURCES.md`](../docs/SOURCES.md).
That ledger is the audit trail — if a judge asks "where did this requirement come from,"
the answer is one lookup away.

## Status

The ontology contains 95 requirements, 81 document definitions, 31 canonical fact types,
four consistency rules, and five audited action definitions. `schema.ts` loads every JSON
file, validates references and rule expressions, rejects cycles and duplicate ids, and
reports unknown turnaround data. Every researched regulatory entry remains intentionally
unverified until a person checks its cited source.
