# /app — Next.js App Router

**One surface: the caseworker.** There is no family-facing UI and the system accepts no
family-facing intake.

```
/login              caseworker sign in
/cases              case list, open a case, state pair + direction   (D1)
/workflow/[caseId]  the dashboard — graph, node panels, verification (F1, F2)
/api/session        sign in / sign out / who am I
/api/cases          case list, create, amend, delete
/api/workflow/[id]  the GraphModel contract over the wire
```

✅ **Scaffolded** (handoff Step 1). Next.js 16 App Router + TypeScript, Tailwind v4,
shadcn/ui, React Flow (`@xyflow/react`) with dagre layout, Zod, Supabase packages installed.
`npm run dev` → http://localhost:3000.

### What is real and what is placeholder

| Working now | Still to build |
|---|---|
| Sign in, sign out, session cookie, persistence | Supabase Auth (`lib/supabase.ts` is wired but unused) |
| Case list, create a case, all 51 jurisdictions | — |
| State pair + direction, saved to the case | — |
| Regulation-derived graph from `/engines/graph.ts`, dagre auto-layout | — |
| Five node states, critical path, node panel, citations, defects | — |
| Synthetic cached upload → extract → verify, plus optional live extraction | — |

### Where the backend plugs in

`lib/workflow-model.ts` is the integration point. It loads case evidence, runs consistency,
validity, delta, and graph derivation, then returns engine output tagged `source: "engine"`.

### Note on the React Flow package

The handoff says `reactflow`. That package's v11 peers on React ≤18 and this scaffold is on
React 19, so the dependency is **`@xyflow/react` v12** — the same library under its current
name, same API. Import from `@xyflow/react`.

### Persistence

`lib/store.ts` is a small JSON-file store so the app runs with zero configuration. Every read
and write goes through it, so moving to Supabase touches that file and `lib/session.ts` and
nothing else. Synthetic records only (hard boundary #3).

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
