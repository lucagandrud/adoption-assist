# /app — Next.js App Router

**One surface: the caseworker.** There is no family-facing UI and the system accepts no
family-facing intake.

```
/cases      case list, state pair + direction selection   (D1)
/workflow   the dashboard — graph, node panels, verification   (F1, F2)
/api        route handlers
```

> ❌ **Not scaffolded.** There is no `package.json` yet. Hours 0–3 create the Next.js app,
> Tailwind + shadcn/ui, and the Supabase connection.

## The flow

```
sign in → /cases → select case → select state pair + direction → /workflow
```

Selecting the state pair is what composes the workflow. Everything after that point is one
screen: the branching graph, the node panel, and the verification loop.

## Non-negotiable framing

**Decision-support for caseworker review. Not an approval decision.** (Hard boundary #5.)

Concretely, in the UI:

- A **green check means the paperwork is consistent and complete.** It never means the family
  is approved, cleared, or assessed. Label it as document status — never as clearance.
- A defect names a contradiction between two documents. It never characterizes the family.
- An unverified requirement (`verified: false`) is badged as unverified wherever it appears.
- Nothing scores, ranks, or recommends approval or denial.

If a family is genuinely unsuitable, the human process must still catch that. A UI that reads
as "all checks passed" invites exactly that failure.

## The graph is the primary UI

Not sequential screens. Full UX specification in [`engines/graph.ts`](../engines/graph.ts) —
node states, requirement panel, critical-path highlighting.

React Flow for rendering, dagre or elkjs for auto-layout. **Never hand-position nodes.**

## Boundary with the engines

Engines produce plain data — `GraphModel`, `Defect[]`, `ValidityReport`. This directory
renders it.

No consistency logic, no date arithmetic, and no state-specific branching in components. If a
component contains `if (state === "TX")`, the value belongs in `/ontology`.
