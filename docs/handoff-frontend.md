# Handoff — Frontend (Luca)

**You own:** `/app`, `/extraction`, `/demo`
**You never touch:** `/ontology`, `/engines`
**Your branch:** `luca`

Your job is the caseworker's screen: sign in, pick a case, and work a branching document
workflow where uploads turn green as they verify.

---

## Step 0 — Do this with Christopher before anything else (30 min)

Open [`demo/fixtures/graph-model.example.json`](../demo/fixtures/graph-model.example.json)
together.

**That file is the contract.** His engines emit exactly that shape. Your dashboard renders
exactly that shape.

**This is what stops you from waiting on him.** You build the entire dashboard against that
static file starting at hour 0. When his `graph.ts` works, you change one import and the app
is live on real data. You are never blocked.

If you need a field added, say it out loud, change it together, both push and pull
immediately.

- [ ] Read the fixture end to end with Christopher
- [ ] Agree the shape is right
- [ ] Commit any changes to `main` together

---

## Step 1 — Scaffold (1.5 hrs)

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false
npx shadcn@latest init
npm install reactflow dagre zod
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] Next.js running on `localhost:3000`
- [ ] Tailwind + shadcn working
- [ ] `.env.local` created (**never commit it** — already gitignored)
- [ ] Committed and pushed to `main` so Christopher has the scaffold too

> Push the scaffold to `main` fast. Christopher can't run anything until `package.json`
> exists.

---

## Step 2 — Load the fixture (30 min)

```ts
import graphModel from "@/demo/fixtures/graph-model.example.json";
```

That's your data source for the next several hours. **Do not wait for the backend.**

- [ ] Fixture imports and typechecks
- [ ] Types written from the fixture shape (`GraphModel`, `GraphNode`, `Defect`)

---

## Step 3 — The workflow dashboard (6 hrs) ← this is the project

**File:** `app/workflow/`

Everything else is supporting. This screen is the demo.

### The graph

React Flow canvas, laid out automatically with dagre. **Never hand-position nodes** — the
graph shape comes from `edges` in the fixture, and it changes when the case changes.

```ts
// build nodes/edges from the fixture, run dagre, feed React Flow
// direction: top-to-bottom ("TB")
```

### Node states — five visual treatments

| State | Look |
|---|---|
| `locked` | Dimmed, muted. Upstream isn't done. |
| `available` | Normal, actionable |
| `in_progress` | Partial indicator |
| `verified` | **Green check.** The moment that sells the product. |
| `defect` | Alert color, defect count badge |

**`defect` beats `verified`.** A node with all inputs present but a contradiction must never
look done.

### Critical path

Nodes with `on_critical_path: true` get a distinct treatment — heavier edge, accent color.
Show `earliest_filing` prominently. It's the most valuable number on the screen.

### The node panel

Opens on click. Must show:

- [ ] Input checklist with satisfied/unsatisfied state
- [ ] **The citation, displayed** — this is the credibility claim, not a footnote
- [ ] An **"Unverified"** badge when `verified: false`
- [ ] Upload control
- [ ] Defects, each naming **both** conflicting documents with page and field

Checklist:

- [ ] Graph renders from fixture with auto-layout
- [ ] All five node states visually distinct
- [ ] Critical path distinguished
- [ ] Node panel opens with citation and inputs
- [ ] Defect renders both sources side by side

---

## Step 4 — Case shell (2 hrs)

**File:** `app/cases/`

- [ ] Sign in (Supabase auth — **fake it with a hardcoded session if you're behind**)
- [ ] Case list
- [ ] Case setup: sending state, receiving state, direction, family profile

**Make direction unmistakable in the UI.** A caseworker who picks CA→TX when they meant
TX→CA gets a confidently wrong workflow, which is worse than no tool.

> If you're behind schedule, **cut auth first.** Hardcode a session. Case selection is
> load-bearing; the login screen is not.

---

## Step 5 — Upload and verification UI (3 hrs)

**Files:** `app/api/upload`, `app/api/verify`, `extraction/pipeline.ts`

The loop: upload → extract → check → green check or defect.

- [ ] Upload control on the node panel
- [ ] **Per-stage progress** — `reading → extracting → checking → done`. A bare spinner reads as a hang, and it *will* hang on conference wifi.
- [ ] Success → node turns green, graph recomputes, downstream unlocks
- [ ] Failure → node goes to `defect`, both sources shown

Extraction calls Claude with vision. Every extracted fact must carry document, page, and
field. **A fact without provenance gets dropped** — Christopher's consistency engine can't
name both sources without it.

Mock the API response first and build the UI against it. Wire up the real Anthropic call once
the states render correctly.

---

## Step 6 — Swap fixture for real data (30 min)

When Christopher says `graph.ts` emits valid contract JSON:

```ts
// before
import graphModel from "@/demo/fixtures/graph-model.example.json";
// after
const graphModel = await fetch(`/api/workflow/${caseId}`).then(r => r.json());
```

If you built against the contract, **nothing else changes.** That's the whole point.

- [ ] Real data renders identically to the fixture
- [ ] Flipping direction produces a visibly different graph

---

## Rules you cannot break

1. **No state logic in components.** If you write `if (state === "TX")`, that value belongs
   in Christopher's ontology. Ask him for it.
2. **No consistency logic or date math in the UI.** Engines produce findings; you render them.
3. **A green check means the paperwork is consistent — never that a family is approved.**
   Label it as document status everywhere. This is a hard boundary, and getting it wrong in
   the UI is the single most damaging mistake available to you.
4. **Show the citation.** Every node, every defect. It's what separates this from a checklist.
5. **Synthetic documents only.** Never upload a real person's records.

---

## Demo-driven priority

If you build these three things and nothing else, the demo works:

1. Graph renders and branches, with citations on nodes
2. A node turns green on successful verification
3. A defect shows both conflicting documents with page and field

Everything else — auth, polish, the timeline view, the delta view — is optional.

---

## Your git loop

```bash
git add -A && git commit -m "app: workflow graph node states" && git push

# every few hours, pull Christopher's work in:
git checkout main && git pull && git checkout luca && git merge main

# when something works, put it in main:
git checkout main && git pull && git merge luca && git push && git checkout luca
```

Or just tell Claude "save my work" / "merge into main".
