# Handoff to Codex — ontology integration, CA/TX/federal relative placement

Written by a Claude Code session for a fresh Codex session that has no memory of the work
described here. Read this fully before touching any file it names. It supplements — does not
replace — `CLAUDE.md` (project brief, hard boundaries, build phases) and
`docs/git-workflow.md`. Read both of those too.

Current repo state at time of writing: branch `christopher`, at commit `ea3e6f2` (merged from
`origin/main`). The Next.js app scaffold, UI components, and API routes are implemented and
run (`npm install && npm run dev` → `localhost:3000`). `/ontology` and `/engines` are still
pseudocode-only placeholders. This handoff is about closing that gap.

---

## 1. What this project is, in one paragraph

A hackathon prototype (DNHacks, Health & Public Service track) that helps caseworkers
assemble and verify interstate foster/adoption placement packets under the ICPC, scoped to a
California↔Texas relative-placement case, both directions (CA→TX and TX→CA). The
architecture is ontology-first: regulatory requirements, documents, and consistency rules are
authored as cited, structured JSON data; a deterministic engine (`engines/graph.ts`) derives a
dependency graph from that data for the dashboard (F1); a separate engine
(`engines/consistency.ts`) checks uploaded documents against it for defects (F2). **No LLM
ever decides whether a requirement is met** — AI only extracts facts from documents; all
comparison logic is arithmetic/deterministic code. Every `Requirement` and `Document` carries
a `source_citation` and a `verified: true/false` flag; nothing invented is allowed to render
as if it were confirmed. Full detail, judging criteria, and hard boundaries are in `CLAUDE.md`
— read it before writing code, not after.

---

## 2. What already exists in the repo (as of commit `ea3e6f2`)

- **App shell — implemented.** Next.js App Router, Tailwind + shadcn/ui, login/case
  selection/workflow pages, React Flow workflow graph components, API routes under `app/api`,
  a local JSON store (`lib/store.ts`) standing in for Supabase. Runs today with no env vars
  required (Supabase/Anthropic keys are optional — see `.env.local.example`).
- **`ontology/schema.ts`, `engines/graph.ts`, `engines/consistency.ts`, `engines/delta.ts`,
  `engines/validity.ts`** — all still pseudocode-only design sketches (banner:
  `PSEUDOCODE — NOT IMPLEMENTED`). Each file already documents its intended algorithm and
  output shape — read the file before writing the real implementation, don't guess the shape.
- **`demo/fixtures/graph-model.example.json`** — the frontend/backend contract. The dashboard
  (already built) renders exactly this shape. `graph.ts`'s real output must match it. Read it
  before writing `graph.ts`.
- **`ontology/{ca,tx,shared}/`** — currently only `README.md` placeholders. No fact types,
  documents, requirements, or rules exist in the real ontology tree yet. That's what this
  handoff's research fills in.
- **`docs/SOURCES.md`** — the citation ledger template exists; every table is currently empty
  (`*(none yet)*`). Needs to be populated from the citations already collected (see below) —
  do this as you place data, not as an afterthought.
- **`docs/handoff-ontology.md`** — the original task breakdown for this work (Steps 0–7,
  hour estimates, hard rules). This handoff assumes you've read it; it does not repeat the
  step-by-step instructions, only reports where each step actually stands.
- **`docs/handoff-frontend.md`** — the frontend owner's parallel handoff. Useful for
  understanding what the dashboard expects but you should not need to touch `/app`,
  `/components`, or `/extraction`.

---

## 3. The research deliverable — what it is, where it currently sits, and how much to trust it

A separate AI research pass (documented in full in `req docs/CLAUDE_CODE_HANDOFF.md`) produced
95 cited regulatory requirements, a reconciled fact-type registry, and a documents stub list,
covering both demo directions. **This data is NOT yet in `/ontology` — it's sitting in two
staging folders at the repo root that need to be read, reconciled, and moved.**

### Staging folders (repo root, not yet in `/ontology`)

```
req docs/
  CLAUDE_CODE_HANDOFF.md              — full methodology, confidence levels, what changed and why
  demo-direction-map.md               — exact requirement-id list per direction (READ THIS SECOND)
  dependency-sequencing-worksheet.md  — phase groupings for depends_on edges (content decision, not mechanical)

req ontology/
  shared/fact-types.json                          — Step 2 deliverable, the fact registry
  shared/requirements/draft-baseline.json         — 5 federal requirements
  ca/requirements/draft-sending-side.json         — 10 CA sending-side requirements
  ca/requirements/draft-relative-placement.json   — 35 CA receiving-side requirements
  ca/requirements/draft-capacity-and-physical-environment.json — 12 more CA receiving requirements
  tx/requirements/draft-sending-side.json         — 13 TX sending-side requirements
  tx/requirements/draft-relative-placement.json   — 20 TX receiving-side requirements
  _draft-documents-to-split/draft-documents.json  — every document type referenced above, stub fields
```

**Read `req docs/CLAUDE_CODE_HANDOFF.md` in full before moving anything.** It explains method,
per-entry confidence, and exactly which entries are stronger or weaker sourced. Then read
`req docs/demo-direction-map.md` — it already computed which requirement files belong to which
demo direction, so you don't need to re-derive that split from `state`/`direction` fields by
hand.

### Trust level — read this before treating any of it as ground truth

- Every single entry has `"verified": false`. This is deliberate and correct — an AI read
  primary/secondary regulatory sources and quoted them, but no human has confirmed any of it
  yet. Do not flip any entry to `verified: true` without an actual human check against the
  cited source.
- Confidence varies entry to entry and is noted **inline in each entry's `source_citation`**
  (e.g. "CONFIRMED current," "spot-check before use," "not independently re-quoted"). Don't
  strip these notes when you reformat the JSON — they're load-bearing context for whoever
  reviews this later.
- California's sending-side data (`ca/requirements/draft-sending-side.json`) is sourced mostly
  from a **county-level** policy (LA County DCFS), not a statewide CDSS regulation — flagged
  per-entry. Texas's sending-side data is sourced from a **statewide** DFPS handbook chapter —
  stronger tier. Don't present the CA sending-side numbers (3-day/5-day timelines, DCFS
  710/711/712 form numbers) as CA-wide without that caveat surviving into the UI or demo
  narrative.
- Two derivations are explicitly blocked on unfinished sub-research (see `fact-types.json`'s
  `open_items_for_whoever_builds_the_extraction_pipeline` array):
  1. `fact.criminal_history.has_qualifying_conviction_or_arrest` /
     `no_1522g_disqualifying_conviction` need a reference table of Health & Safety Code
     §1522(e) and §1522(g)(1)(A)-(C) offense codes that was never transcribed.
  2. Texas's expedited-ICPC eligibility test (§4512) needs a reference table crossing
     qualifying relationships with qualifying circumstances that was never transcribed.
  **Only resolve these if your consistency rules actually gate on criminal history or TX
  expedited eligibility. Skip otherwise** — don't invent the offense codes to unblock a rule
  no one asked for.

---

## 4. Gap assessment — what Step 4/5/6/7 of `docs/handoff-ontology.md` actually need before they're done

This is the part most likely to bite if skipped. The research is strong on content but leaves
real work before `engines/graph.ts` can emit anything meaningful:

1. **`depends_on` edges are almost entirely unwired.** `dependency-sequencing-worksheet.md`
   groups all 95 requirements into life-cycle phases (intake → background → home/environment →
   psychosocial → health/training → filing/decision) but explicitly leaves wiring the real
   edges as a human/Codex judgment call — only ~4 edges are actually set in the JSON today
   (the worksheet says which ones and why). `docs/handoff-ontology.md` Step 4 requires a chain
   **at least 4 levels deep** and says a flat/disconnected requirement list "shows nothing, no
   matter how many you author." **This is the single biggest remaining blocker** — without it,
   the dashboard graph will render mostly-parallel nodes, not the branching structure F1 needs.
   Use the worksheet's phase groupings to decide real edges; it is scoped and reasoned, not a
   blank slate.
2. **Documents are a stub.** In `_draft-documents-to-split/draft-documents.json`,
   `validity_period_days` and `external_turnaround_days` — the two fields
   `docs/handoff-ontology.md` Step 3 calls out as driving expiration warnings and the critical
   path respectively — are `null` on nearly every entry. A few are populated with real citations
   (e.g. `doc-health-screening-form`: 365 days, `doc-comprehensive-assessment-report`: 60-day
   turnaround). Leave the rest `null` rather than guessing — the UI is expected to show
   "unknown" for these, per the file's own top-level note — but consider a light pass to source
   a few more for whichever documents your demo's critical path actually depends on.
3. **No consistency rules exist yet.** Step 5 of `docs/handoff-ontology.md`
   (`addresses_match` first, then `names_match`, `income_matches_tax_return`,
   `household_size_consistent`, `bedrooms_support_child_count`) hasn't been started in this
   research pass at all — there is no `rules/*.json` anywhere. This is F2, the defect-detection
   demo beat ("the money shot"). Needs to be authored from scratch using the fact types already
   registered in `shared/fact-types.json`.
4. **Files are not in the real ontology tree.** Everything under `req ontology/` needs to move
   into `ontology/{ca,tx,shared}/...` per the manifest in section 5 below, including splitting
   `draft-documents.json` by each entry's `states_accepted` field into
   `ontology/{ca,tx,shared}/documents/`. Three document ids are shared across states
   (`doc-child-ssn-card`, `doc-child-birth-certificate`, `doc-monthly-contact-log`) — those go
   under `ontology/shared/documents/`, not under either state's folder; the reasoning is in
   `CLAUDE_CODE_HANDOFF.md` item 5.
5. **`docs/SOURCES.md` is still empty.** Populate its citation ledger tables from the
   `source_citation` fields already present in every requirement/document JSON entry as you
   place them — don't reconstruct citations from memory, they're already sitting in the data.
6. **`ontology/schema.ts` is still pseudocode.** Needs real Zod schemas (per
   `docs/handoff-ontology.md` Step 6), then boot-time validation: every `depends_on` id
   resolves, every `satisfied_by_documents`/`satisfied_by_facts` id resolves, the fact registry
   covers every fact key referenced, and the dependency graph is acyclic — throw loudly on
   failure, never continue with partial data. The research handoff says a corpus-wide Python
   check already confirmed no duplicate ids, no dangling references, and no cycles across the
   95 requirements as originally drafted — treat that as a smoke test to reproduce in
   TypeScript once the files are moved and rules are added, not a substitute for it.
7. **Engines (`graph.ts`, `consistency.ts`, `delta.ts`, `validity.ts`) are still pseudocode.**
   Each file's existing comments already spec the algorithm and output shape — implement
   against those, and against `demo/fixtures/graph-model.example.json` for `graph.ts`
   specifically. `graph.ts` emitting valid contract JSON is the most important milestone in
   this whole handoff — once it does, the already-built frontend can swap the fixture for real
   data and the app is live end to end.

---

## 5. File placement manifest

| Source (staging) | Target | Notes |
|---|---|---|
| `req ontology/shared/fact-types.json` | `ontology/shared/fact-types.json` | Move as-is |
| `req ontology/shared/requirements/draft-baseline.json` | `ontology/shared/requirements/` (split per Step 4's "one file per requirement group" rule if desired) | 5 federal requirements, used by both directions |
| `req ontology/ca/requirements/draft-sending-side.json` | `ontology/ca/requirements/` | 10 reqs, `direction: "sending"`, county-sourced — see confidence caveat above |
| `req ontology/ca/requirements/draft-relative-placement.json` | `ontology/ca/requirements/` | 35 reqs, `direction: "receiving"` |
| `req ontology/ca/requirements/draft-capacity-and-physical-environment.json` | `ontology/ca/requirements/` | 12 reqs, `direction: "receiving"` |
| `req ontology/tx/requirements/draft-sending-side.json` | `ontology/tx/requirements/` | 13 reqs, `direction: "sending"`, statewide-sourced |
| `req ontology/tx/requirements/draft-relative-placement.json` | `ontology/tx/requirements/` | 20 reqs, `direction: "receiving"` |
| `req ontology/_draft-documents-to-split/draft-documents.json` | split by `states_accepted` into `ontology/ca/documents/`, `ontology/tx/documents/`, `ontology/shared/documents/` | 3 ids are shared (see above) — those go to `shared` regardless of which state's section they were listed under |
| `req docs/demo-direction-map.md` | `docs/demo-direction-map.md` | Reference doc, not ontology data |
| `req docs/dependency-sequencing-worksheet.md` | `docs/dependency-sequencing-worksheet.md` | Reference doc — use it to wire real `depends_on` edges, then it can stay as a record of the reasoning |
| `req docs/CLAUDE_CODE_HANDOFF.md` | `docs/` (keep, rename if you like, e.g. `docs/ontology-research-handoff.md`) | Full methodology record — keep for provenance, don't delete |

After moving, delete the now-empty `req docs/` and `req ontology/` staging folders.

---

## 6. Ordered next steps

1. Read `req docs/CLAUDE_CODE_HANDOFF.md` and `req docs/demo-direction-map.md` in full (both
   already read in full to produce this handoff — nothing in them should surprise you if
   you've read this document, but read the originals before editing their content).
2. Move files per the manifest in section 5, splitting `draft-documents.json` by
   `states_accepted`.
3. Populate `docs/SOURCES.md` from the citations now sitting in the moved JSON files.
4. Use `dependency-sequencing-worksheet.md` to wire real `depends_on` edges into the moved
   requirement JSON — this is the biggest content gap (section 4, item 1). Confirm with a
   human before treating an inferred edge as settled if it isn't explicit in a citation.
5. Optionally source a few more `validity_period_days` / `external_turnaround_days` values for
   documents on your demo's critical path; leave the rest `null`.
6. Author consistency rules (`ontology/{ca,tx,shared}/rules/*.json`) starting with
   `addresses_match`, per `docs/handoff-ontology.md` Step 5's priority order.
7. Write real Zod schemas in `ontology/schema.ts`, load everything, validate, confirm the
   dependency graph is acyclic and every reference resolves.
8. Implement `engines/graph.ts` against `demo/fixtures/graph-model.example.json` — this is the
   milestone that makes the already-built frontend live end to end.
9. Implement `engines/consistency.ts`, `engines/validity.ts`, `engines/delta.ts` per their
   existing pseudocode specs.

## 7. Hard rules — do not violate (restated from `CLAUDE.md` and `docs/handoff-ontology.md`)

1. Never invent a requirement, document, or citation. No source → `verified: false` → visible
   in the UI. A fabricated statute number is the fastest way to lose this project.
2. No state logic in `/engines`. Nothing may branch on `"CA"` or `"TX"` in code — thresholds
   and branching live in the ontology data. Adding a 51st state should require zero engine
   code changes.
3. Never hand-author the graph. Set `depends_on` edges in the data; `graph.ts` derives the
   graph from them.
4. No LLM in the engines. `graph.ts`, `consistency.ts`, `validity.ts`, `delta.ts` are
   arithmetic and comparison only. AI extracts facts from documents elsewhere in the pipeline
   (`/extraction`) — it never decides whether a requirement is met.
5. Every defect a consistency rule produces must name both conflicting sources, with document,
   page, and field where available — write defect messages as questions ("Which is current?"),
   not accusations.
6. Facts are tagged `extracted` / `attested` / `derived` in the registry for a reason — never
   let an engine treat an `attested` (human-judgment) fact as something it can compute or infer
   on its own.
