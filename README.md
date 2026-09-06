# ICPC Compliance Workbench

**AI tooling for caseworkers handling interstate foster care and adoption placements.**

Interstate placement packets are rejected for administrative defects — a mismatched address,
a clearance that lapsed, a document filed out of order. Each rejection costs caseworker hours
and adds months to a child's time in care. This is a workbench that derives the correct
document workflow from state regulations and verifies every upload against them
automatically.

Built for **DNHacks**, Health and Public Service category, in a 26-hour window.

> **Status: pre-build.** No implementation. Every source file is comment-only and marked
> `PSEUDOCODE — NOT IMPLEMENTED`.

---

## Scope

**Caseworker-facing only.** There is no family-facing surface and this system does not
accept documents from families. Caseworkers already hold these records; the workbench
operates on what the agency has.

That boundary is deliberate — it removes consumer PII intake from the threat model entirely
and keeps the build focused on the two features that carry the demo.

**Two states: California and Texas**, both directions (CA→TX, TX→CA). The regimes are
structurally different — California uses Resource Family Approval as a unified process,
Texas uses DFPS home screening and licensing — so the composed workflow genuinely differs by
direction rather than being a relabeled checklist.

Architecture generalizes to 50 states. **Only ontology data is state-specific; no state
logic in code.**

---

## The problem

| Fact | Value | Source |
|---|---|---|
| Annual ICPC home study requests | ~40,000 | Sankaran (2014), ABA *Child Law Practice* 33(6) |
| Denial rate | ~40% of placement requests | Sankaran (2014) |
| Decision window | 180 calendar days from receipt of request | ICPC Regulations, AAICPC |
| Right of appeal | **None** — only a review request or a new filing | ABA Section of Litigation |
| Caseworker documentation burden | 4.3 hrs per 8-hr day | OPRE (federal), July 2025 |
| Children in foster care, FY2024 | 328,947 | AFCARS FY2024 |

Full citations in [`docs/SOURCES.md`](docs/SOURCES.md). These are the only statistics this
project uses.

**Where the cost is.** A defective packet is denied, there is no appeal, and the case starts
over while a child waits. The defects that cause this are overwhelmingly administrative —
they are catchable before submission by anything that actually reads the documents against
the governing requirements.

**Why this doesn't already exist.** NEICE digitized the transport layer: 47 jurisdictions
exchange ICPC packets electronically today, and the Family First Prevention Services Act
requires universal participation by 2027. But NEICE is office-to-office document exchange.
It moves packets. **Nothing evaluates whether a packet is correct before it enters the pipe.**

This is a pre-submission layer that feeds NEICE. It does not compete with it.

---

## Product flow

```
sign in
  └─ select case
       └─ select state pair          CA ⇄ TX, with direction
            └─ WORKFLOW DASHBOARD
                 ├─ branching document graph, derived from both states' regulations
                 ├─ upload a document → extract → ontologize → verify
                 └─ green check when an item passes; defect when it does not
```

Selecting the state pair is what composes the workflow. The applicable requirement set is
resolved from the sending state's sending-direction requirements, the receiving state's
receiving-direction requirements, and the federal baseline — then the dependency graph is
derived from that set.

---

## The two core features

Everything else is supporting infrastructure or deferred.

### F1 — Workflow dashboard

A branching, stepwise document workflow, **derived from regulation data rather than
hand-authored**, showing what must be filed, in what order, and what is blocked by what.

- DAG built from `Requirement.depends_on` edges — never a hand-written node list
- Node states: `locked`, `available`, `in_progress`, `verified`, `defect`
- Clicking a node opens its panel: required inputs, the governing citation, verification status
- Critical path distinguished from slack, using `external_turnaround_days`
- Auto-layout via dagre or elkjs — no hand-positioned nodes

**Done when:** choosing a case and a state pair renders a correct branching workflow for that
direction, with every node traceable to a citation, and the graph changes when the direction
flips.

**This is the primary UI. Not sequential screens.**

### F2 — AI verification with green checks

The caseworker uploads a document. The system extracts typed facts, writes them into the
ontology with provenance, checks them against the governing requirements and against every
other fact already on the case, and marks the item verified or flags a defect.

The checks that matter are the small ones that get packets rejected:

| Check | Example defect |
|---|---|
| Cross-document consistency | Address on the tax return ≠ address on the home study |
| Name consistency | Legal name differs across ID, application, marriage certificate |
| Household size | Declared size ≠ individuals appearing across medical forms and clearances |
| Income tolerance | Declared income ≠ tax return, outside tolerance |
| Field completeness | Required field blank or illegible |
| Document validity | Clearance expires before the projected decision date |

**Done when:** uploading a document produces either a green check or a defect naming both
conflicting sources, the page and field each value came from, and the rule violated.

> **A green check means the paperwork is consistent and complete. It never means the family
> is approved.** See [Hard boundaries](#hard-boundaries).

---

## Architecture

Ontology at the center. Documents are extracted into canonical typed facts, and every engine
operates on facts rather than on documents.

### Data model

```
Fact              a canonical typed value extracted from a document
                  id, type, value, provenance[], confidence, extracted_at

Document          an artifact in the case file
                  id, type, states_accepted, issue_date, validity_period_days,
                  yields_facts[], external_turnaround_days, source_citation, verified

Requirement       an obligation imposed by a state or by the compact
                  id, state, direction (sending|receiving), applies_to,
                  satisfied_by_documents[], satisfied_by_facts[], depends_on[],
                  source_citation, verified

ConsistencyRule   an assertion that must hold across facts
                  id, expression, facts_involved[], severity, defect_message,
                  source_citation

Action            a verb — a state transition a caseworker can invoke
                  id, applies_to, preconditions[], effects[], audit
```

`Action` is what makes this an ontology rather than a schema. `verify`, `flag`, `override`,
`request_renewal`, `mark_filed` are modeled as typed operations with preconditions and
recorded effects — so the case has an audit trail, and an override is a first-class event
with an author rather than a mutated field.

### Derivation, not authoring

- `depends_on` edges produce the workflow graph
- `external_turnaround_days` produces the critical path
- `validity_period_days` produces expiration risk
- `source_citation` + `verified` on every requirement and document is what separates this
  from a checklist app

### Where AI sits

**Extraction only.** Claude with vision reads documents into typed facts with page-and-field
provenance. Everything downstream — consistency checks, date arithmetic, graph derivation —
is deterministic code.

An LLM never decides whether a requirement is met. It reads what a document says; rules
authored from published regulation text decide the rest. This is a correctness position and
a demo position: deterministic engines produce the same output every run.

### Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Deploy | Vercel |
| UI | Tailwind + shadcn/ui |
| Graph | React Flow + dagre/elkjs |
| Data | Supabase (Postgres + auth + storage) |
| Validation | Zod, at boot |
| AI | Anthropic API (Claude with vision) — extraction only |

One repo, one deploy target, no separate backend.

---

## Deliverables

**Foundation**

| | Deliverable | Definition of done |
|---|---|---|
| **D0** | **Ontology** — CA + TX requirements, documents, fact types, rules | Loads and validates at boot; every entry carries `source_citation` and `verified`; unsourced entries render as unverified |
| **D1** | **Case shell** — sign in, case selection, state pair + direction | A caseworker reaches a composed workflow for a chosen case and direction |

**Core**

| | Deliverable | Definition of done |
|---|---|---|
| **F1** | **Workflow dashboard** | Correct branching graph derived from regulation data, critical path shown, citations on every node |
| **F2** | **AI verification** | Upload → extract → ontologize → check → green check or a defect naming both sources with page/field provenance |

**Demo**

| | Deliverable | Definition of done |
|---|---|---|
| **D2** | **Example case + synthetic documents** | One case drives the full demo without manual setup; all documents fabricated |

**Deferred — designed, not built**

| | Deliverable | Why deferred |
|---|---|---|
| D3 | 180-day validity timeline | Expiration checking lands inside F2; the dedicated timeline view is a stretch |
| D4 | State-pair delta view | Pair resolution is already required by F1; rendering the diff as its own comparison screen is a stretch |

### Cut order

```
CUT FIRST →  D3 timeline view
             D4 delta view
             D1 auth (hardcode a session, keep case selection)
NEVER CUT →  F1 workflow dashboard, F2 AI verification
```

F1 and F2 are the project. If either is weak, nothing else compensates.

---

## Hard boundaries

Not style preferences. Crossing any of them loses the project.

1. **No substantive assessment.** The system checks completeness, consistency, validity, and
   sequencing. It never judges whether a family is fit — that is a licensed social worker's
   clinical judgment. A green check means *the paperwork is consistent*, never *this family
   is approved*. If a family is genuinely unsuitable, the human process must still catch
   that, and the UI must not obscure it.

2. **No learned model on denial outcomes.** There is no public corpus of ICPC denial records.
   The rules are authored from published regulation text and are agency-editable. AI performs
   extraction at runtime; **the rules are authored, not learned.** Never claim otherwise.

3. **No real records.** All demo data is synthetic. The system takes no family-facing intake
   and stores no real person's documents.

4. **No invented requirements.** If a CA or TX requirement is not sourced from an actual state
   document, it is marked `verified: false` and surfaced as unverified. *Fabricated
   regulatory content is the fastest way to lose this.*

5. **Decision-support framing.** The UI supports caseworker review. It does not approve,
   deny, score, or rank.

---

## Repository layout

```
/ontology
  /ca              California — Resource Family Approval
  /tx              Texas — DFPS home screening and licensing
  /shared          Federal ICPC requirements, canonical fact types, actions
  schema.ts        Zod schemas for all object types
/engines
  graph.ts         F1 — workflow DAG + critical path
  consistency.ts   F2 — cross-document verification
  validity.ts      Expiration math (used by F2, timeline view deferred)
  delta.ts         State-pair resolution (used by F1, comparison view deferred)
/extraction
  pipeline.ts      document → typed facts with provenance
  /prompts         extraction prompts per document type
/app
  /cases           case list, state pair + direction selection
  /workflow        the dashboard — graph, node panels, verification
  /api             route handlers
/demo
  /cases           synthetic example case and documents
/docs
  IMPACT.md        quantification model
  SOURCES.md       citation ledger
  git-workflow.md  terminal reference
```

Every directory carries a README describing what belongs in it.

---

## Build phases

**Before the event:** source and encode the CA and TX requirement data. This is the long pole
and it cannot be compressed. Every requirement needs a citation. *(Confirm DNHacks rules on
advance work before writing any code.)*

| Hours | Work |
|---|---|
| 0–3 | Scaffold, Supabase, ontology schemas, seed data loading and validation |
| 3–7 | Extraction pipeline: upload → typed facts with provenance |
| 7–12 | **F1** — state pair resolution, DAG derivation, critical path |
| 12–17 | **F1** — React Flow dashboard, node panels, branching UI |
| 17–21 | **F2** — consistency rules, verification loop, green-check states |
| 21–23 | Case shell, example case, synthetic documents |
| 23–24 | Deploy, IMPACT.md |
| 24–26 | Rehearse. **Freeze at hour 24.** |

---

## Getting started

```bash
git clone https://github.com/lucagandrud/icpc-compliance-engine.git
cd icpc-compliance-engine
npm install
npm run dev            # http://localhost:3000
```

No configuration is required to run it. Sign in with any name and email; cases persist to a
local JSON file (`.data/workbench.json`, gitignored) through `lib/store.ts`. Supabase and the
Anthropic key are wired but optional — copy `.env.local.example` to `.env.local` when you need
them.

Read in order:

1. [`CLAUDE.md`](CLAUDE.md) — the standing brief, read fully before writing code
2. **Your handoff doc** — step-by-step for your half of the build:
   - [`docs/handoff-ontology.md`](docs/handoff-ontology.md) — Christopher: authoring `/ontology`
   - [`docs/handoff-integration.md`](docs/handoff-integration.md) — Christopher: wiring the ontology into the app and Postgres
   - [`docs/handoff-frontend.md`](docs/handoff-frontend.md) — Luca: `/app`, `/extraction`, `/demo`
   - [`docs/supabase-setup.md`](docs/supabase-setup.md) — provisioning the database
3. [`docs/git-workflow.md`](docs/git-workflow.md) — branch, commit, merge, recovery

### The contract

[`demo/fixtures/graph-model.example.json`](demo/fixtures/graph-model.example.json) defines the
boundary between backend and frontend. The engines emit that shape; the dashboard renders it.

Both people build against it from hour 0, so neither waits on the other. **Read it together
before writing any code**, and never change it unilaterally — it breaks both sides at once.

Find remaining pseudocode:

```bash
grep -rln "PSEUDOCODE — NOT IMPLEMENTED" --include="*.ts" .
```

---

## Engineering principles

1. **The ontology is the product.** A beautiful graph over thin requirement data loses.
2. **Provenance everywhere.** Every fact traces to a document and page; every requirement to a citation.
3. **Deterministic where possible.** AI extracts. Arithmetic decides.
4. **Nothing invented.** Unsourced → `verified: false` → visible in the UI.
5. **Demo-first.** The app runs end-to-end on the example case at every checkpoint.
6. **Freeze at hour 24.** Two hours of rehearsal beats one more feature.
