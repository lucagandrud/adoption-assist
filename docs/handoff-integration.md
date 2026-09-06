# Handoff — Wiring the ontology into the app (Christopher)

**Read after** [`handoff-ontology.md`](handoff-ontology.md). That one gets the ontology
authored; this one gets it driving the product.

**You own:** `/ontology`, `/engines`, and the migrations you add under `/supabase`.
**You never touch:** `/app`, `/components`, `/extraction`.
**Your branch:** `christopher`

---

## First: catch up

You are several commits behind. The app now exists.

```bash
git checkout main && git pull
git checkout christopher && git merge main
npm install
npm run dev
```

Sign up with any email and an 8-character password. You will land on a caseload of five
synthetic cases. Click one — that graph is the fixture, not your ontology. **Your job is to
make it real.**

---

## The one thing to understand before you start

There are two completely different kinds of data here, and conflating them is the mistake that
would cost you hours.

| | Lives in | Why |
|---|---|---|
| **The ontology** — requirements, documents, rules, fact types | **Versioned JSON in `/ontology`**, loaded and validated at boot | It is *reference data*. It is the same for every caseworker in a state. It belongs in git, where it is diffable, reviewable, and rolls back with a deploy. |
| **Case artifacts** — uploads, extracted facts, node states, defects, audit events | **Postgres** | It is *user data*. It differs per case, changes constantly, and must be isolated per caseworker. |

**Do not put requirements in Postgres.** It sounds like the tidy thing to do and it is wrong
here: you would gain nothing, lose git history on your most valuable asset, and add a
migration step to every requirement edit during a 26-hour build. CLAUDE.md §6.1 specifies
versioned JSON validated with Zod at boot — follow it.

> *"But CLAUDE.md says the taxonomy is agency-editable."* It is — by editing the JSON and
> deploying. Making it editable through a UI is a real product someday. It is not this weekend,
> and building toward it now costs you the ontology depth that actually wins.

So when this doc says "integrate with Supabase," it means **the case artifacts your engines
produce**, not the ontology itself.

---

## What is already built and waiting for you

| Thing | Where | State |
|---|---|---|
| The contract | [`demo/fixtures/graph-model.example.json`](../demo/fixtures/graph-model.example.json) | Your engines emit this shape |
| TypeScript types for it | [`lib/types.ts`](../lib/types.ts) | Hand-written from the fixture |
| **The swap point** | [`lib/workflow-model.ts`](../lib/workflow-model.ts) | ~10 lines change, nothing else |
| Node state rendering | [`lib/node-state.ts`](../lib/node-state.ts) | All five states already styled |
| Auth + per-caseworker isolation | [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) | Done, with RLS |
| Setup walkthrough | [`docs/supabase-setup.md`](supabase-setup.md) | Luca may have run it already — ask |

There is also a visual of the contract: open `docs/fixture-preview.html` in a browser. Faster
than reading the JSON.

---

## Step 1 — Ontology loader with boot validation (1 hr)

**File:** `ontology/schema.ts` — replace the pseudocode with real Zod schemas.

Load every JSON file under `/ontology/{shared,ca,tx}`, parse through Zod, and **throw on
failure — never continue with partial data.** Then the checks Zod cannot express:

- [ ] Every `depends_on` id resolves to a real requirement
- [ ] Every `satisfied_by_documents` id resolves to a real document
- [ ] Every fact key resolves to the registry
- [ ] **The dependency graph is acyclic** — a cycle means the case can never start, and it must fail loudly at boot rather than silently at render
- [ ] Unverified entries collected so the UI can badge them

Cache the parsed result in a module-level variable. This runs once per server process, not per
request.

---

## Step 2 — Make `graph.ts` emit the contract (4 hrs) ← the milestone

**File:** [`engines/graph.ts`](../engines/graph.ts). The algorithm is already sketched in the
file — read it before writing code.

Export exactly this:

```ts
export function buildGraphModel(input: {
  case_id: string;
  label: string;
  sending_state: string;
  receiving_state: string;
  profile: { relationship: string; children_count: number; placement_type: string };
  window_start: string;
}): GraphModel;
```

Import `GraphModel` from `@/lib/types` — **do not redeclare it.** One definition, or the two
halves drift apart and the failure shows up as a blank screen.

### Validate your own output

Write a Zod schema for `GraphModel` and run your engine's output through it in development.
When the dashboard renders nothing, you want an error naming the missing field, not a blank
canvas and twenty minutes of guessing.

### The bar for "done"

- [ ] Output parses against the contract shape
- [ ] Node states are computed, with **`defect` outranking `verified`** — a node with all inputs present but a contradiction must never read as done
- [ ] Critical path computed from `external_turnaround_days`
- [ ] **CA→TX and TX→CA produce visibly different graphs**

That last one is demo beat #1 and it is an ontology-depth problem, not a code problem. Check
it early. If both directions render the same picture, no amount of engine work fixes it.

---

## Step 3 — Flip the swap point (15 min)

**File:** [`lib/workflow-model.ts`](../lib/workflow-model.ts). This is the only file in `/app`
or `/lib` you touch, and the header comment already spells out the change.

```ts
import { buildGraphModel } from "@/engines/graph";

export function graphModelForCase(record: CaseRecord): GraphModel {
  const model = buildGraphModel({
    case_id: record.id,
    label: record.label,
    sending_state: record.sending_state,
    receiving_state: record.receiving_state,
    profile: {
      relationship: record.relationship,
      children_count: record.children_count,
      placement_type: record.placement_type,
    },
    window_start: record.window_start,
  });
  return { ...model, source: "engine" };
}
```

`source: "engine"` drops the "placeholder structure" banner the dashboard currently shows.

**Tell Luca the moment this lands.** It is the point where the app stops being a mockup.

Keep the fixture path reachable behind a flag or a try/catch for the first hour. If your
engine throws at 3am, a fixture-backed demo beats a crash.

---

## Step 4 — Case artifacts in Postgres (2 hrs)

Now the Supabase part. Your engines produce per-case data that has to persist and stay
isolated per caseworker.

**File:** `supabase/migrations/0002_case_artifacts.sql` — a **new** file. Do not edit `0001`;
it is already applied.

Tables to add:

| Table | Holds |
|---|---|
| `documents` | One row per uploaded artifact: case id, document type, storage path, issue date |
| `facts` | Extracted typed facts with provenance — document id, **page**, **field**, confidence |
| `requirement_state` | Per case, per requirement: current node state, when it changed |
| `defects` | Rule id, severity, message, and the conflicting sources (jsonb array, always ≥2) |
| `action_events` | Append-only audit: `verify`, `flag`, `override`, `mark_filed` — actor, note, timestamp |

### The RLS pattern you must get right

These tables have no `owner_user_id` of their own — ownership comes through the case. Every
policy needs the join:

```sql
alter table public.facts enable row level security;

create policy "caseworker reads facts on own cases"
  on public.facts for select
  using (
    exists (
      select 1 from public.cases c
      where c.id = facts.case_id
        and c.owner_user_id = auth.uid()
    )
  );
```

Repeat per verb and per table. Copy the shape from `0001_init.sql`.

⚠️ **If a query returns nothing and you cannot see why, the answer is almost always RLS.**
Fix the policy. **Never disable RLS to make something work** — that silently makes every
caseworker's data readable by every other one, and you will not notice until a judge asks.

### Two things to preserve

- **Facts without page and field provenance do not get stored.** Your consistency engine
  cannot name both sources in a defect without them, and that naming is the whole demo.
- **`action_events` is append-only.** An `override` is an audited event with an author and a
  written reason, never a flipped boolean. Requirement state is *derived* by folding events —
  two writers of truth drift, one does not.

---

## Step 5 — Wire consistency into verification (3 hrs)

**File:** [`engines/consistency.ts`](../engines/consistency.ts)

Export:

```ts
export function runConsistencyChecks(
  facts: Fact[],
  rules: ConsistencyRule[],
): Defect[];
```

`Defect` comes from `@/lib/types`. Every defect names **both** conflicting sources with
document, page, and field — a defect with fewer than two sources is a bug, not an edge case.

Luca owns `/api/verify` and calls into this. **Agree on the signature before either of you
builds against it.**

Priority order: `addresses_match` first and solid, since it drives the demo's money shot. Then
names, income, household size.

---

## Step 6 — Derive completion, stop storing it (30 min)

`cases.completion_pct` is currently a stored placeholder that drives tile size on the caseload
grid. Once your engine runs, it should be **derived**:

```
completion_pct = verified nodes / total nodes
```

Compute it in `lib/workflow-model.ts` alongside the graph. Leave the column in place for now —
dropping it mid-build is not worth the risk — but stop writing to it, and let the grid read the
derived value. Two sources of truth will drift within hours.

---

## Rules you cannot break

1. **No state logic in `/engines`.** Nothing may branch on `"CA"` or `"TX"`. Thresholds,
   validity periods, and tolerances all come from the ontology. Test: adding a 51st
   jurisdiction should need zero code changes.
2. **No LLM in the engines.** They are arithmetic and comparison. AI reads documents; it never
   decides whether a requirement is met.
3. **Never invent a requirement or a citation.** No source → `verified: false`. A fabricated
   statute number loses this in front of a public-sector judge.
4. **Never hand-author the graph.** Set `depends_on`; let the DAG derive.
5. **Never disable RLS.**
6. **A green check means the paperwork is consistent — never that a family is approved.**

---

## Working with AI on this

You will be prompting Claude through most of it. Two things that make a real difference:

**Point it at the contract first.** Start sessions with:

> Read `CLAUDE.md`, `docs/handoff-integration.md`, and `demo/fixtures/graph-model.example.json`.
> I own `/ontology` and `/engines`. Don't touch `/app`, `/components`, or `/extraction` —
> Luca owns those. Commit to the `christopher` branch only.

**Do not let it invent regulatory content.** This is the failure mode that matters most for
your half. If you ask for "California RFA requirements" it will happily produce plausible,
confident, fabricated citations. Give it the source text you collected and have it *encode*
what you provide. Anything it produces without a source you handed it gets
`"verified": false`.

---

## Order of work

```
1. Ontology loader + boot validation        1 hr
2. graph.ts emits the contract              4 hrs   ← tell Luca when this lands
3. Flip the swap point                      15 min
4. 0002 migration for case artifacts        2 hrs
5. Consistency engine into verification     3 hrs
6. Derive completion                        30 min
```

**Steps 1–3 are the priority.** They are what turns the app from a mockup into the product. If
you run out of time, 4–6 can be faked; 1–3 cannot.

---

## Your git loop

```bash
git add -A && git commit -m "engines: critical path from turnaround days" && git push

# pull Luca's work in every few hours
git checkout main && git pull && git checkout christopher && git merge main

# when something works
git checkout main && git pull && git merge christopher && git push && git checkout christopher
```

Merge to main early and often. Luca cannot use what is sitting on your branch.
