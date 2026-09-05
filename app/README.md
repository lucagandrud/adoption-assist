# /app — Next.js App Router

The surface. The engines are the product; this is how they are seen.

```
/family      intake portal + dependency graph UI   (D3, D6)
/caseworker  assembled packet review               (D7)
/api         route handlers
```

> ❌ **Not scaffolded yet.** There is no `package.json` in this repository. Hour 0–2 creates
> the Next.js app, Tailwind + shadcn/ui, and the Supabase connection.

## The two surfaces

| Surface | User | What they do |
|---|---|---|
| `/family` | The family | Supply documents and narrative, work the dependency graph, produce a complete family-side packet |
| `/caseworker` | The caseworker | Receive the assembled packet with all checks already run, review, exercise judgment, submit |

**Families do not file ICPC packets.** The ICPC-100A is filed by the sending state agency.
Families originate nearly all the underlying data but are not the filer, and the UI must
never imply otherwise.

## Non-negotiable UI framing

**This is decision-support for caseworker review, not an approval decision.** (Hard boundary
#5.) Nothing in the interface may read as the system approving or denying a placement, or as
assessing whether a family is fit.

Concretely:
- A "complete" node means *the paperwork is complete*, not *you passed*
- A defect names a contradiction between two documents; it never characterizes the family
- Interview-sourced fields are always visibly flagged for human review
- An unverified requirement (`verified: false`) is badged as unverified wherever it appears

## The graph is the primary UI

Not sequential screens. See [`engines/graph.ts`](../engines/graph.ts) for the full UX
specification — node states, the requirement panel, the Automate action, and critical-path
highlighting.

React Flow for rendering, dagre or elkjs for auto-layout. **Never hand-position nodes.**

## Boundary with the engines

The engines produce plain data — `Defect[]`, `ValidityReport`, `GraphModel`, `DeltaReport`.
This directory renders it. Keep that line clean: no consistency logic, no date arithmetic,
and no state-specific branching in components.
