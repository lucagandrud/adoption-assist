# ICPC Pre-Submission Compliance Engine

**A family-facing intake portal backed by a machine-readable requirements ontology that
catches packet defects, expiration risks, and sequencing errors before an ICPC packet
reaches a caseworker — so that submissions are correct on the first attempt.**

Built for **DNHacks**, Health and Public Service category, in a 26-hour window.

> **Status: pre-build.** Nothing in this repository is implemented. Every source file is
> commented pseudocode marked `PSEUDOCODE — NOT IMPLEMENTED`. See
> [Current status](#current-status) for exactly what exists and what does not.

---

## Table of contents

- [The problem](#the-problem)
- [What this is, precisely](#what-this-is-precisely)
- [Deliverables](#deliverables)
- [Hard boundaries](#hard-boundaries)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Build phases](#build-phases)
- [Demo script](#demo-script)
- [Current status](#current-status)
- [Getting started](#getting-started)

---

## The problem

Any child placed across state lines for foster care or adoption must be approved under the
Interstate Compact on the Placement of Children (ICPC). The receiving state conducts a home
study and approves or denies the placement.

| Fact | Value | Source |
|---|---|---|
| Annual ICPC home study requests | ~40,000 | Sankaran (2014), ABA *Child Law Practice* 33(6); Annie E. Casey Foundation study, 27 states responding |
| Denial rate | ~40% of ICPC placement requests | Sankaran (2014) |
| Tennessee denial rates, 6-year avg | 35% overall; 58% parents; 46.4% relatives | Sankaran (2014) |
| Regulatory decision window | Final approval or denial no later than **180 calendar days** from receipt of initial home study request | ICPC Regulations, AAICPC |
| Right of appeal | **None.** Only remedy is requesting review or filing a new ICPC request | ABA Section of Litigation, Children's Rights Committee |
| Caseworker paperwork burden | 4.3 hours per 8-hour day on documentation | OPRE (federal), published July 2025; data collected 2021–2022 |
| Children in foster care, FY2024 | 328,947 (6th consecutive annual decline) | AFCARS FY2024 |
| Legally free with adoption permanency plan, still in care | 34,817 | AFCARS FY2024 |
| Adoptions from foster care, FY2024 | 46,935 (lowest since 1999, down 26% since 2019) | AFCARS FY2024 |

These are the only statistics this project uses. See [`docs/SOURCES.md`](docs/SOURCES.md)
for the citation ledger and the rule against inventing numbers.

### The gap we are filling

NEICE (National Electronic Interstate Compact Enterprise) already digitized ICPC. 47 states
and jurisdictions are fully operational, and the Family First Prevention Services Act of
2018 requires all states to join by 2027. But NEICE is **state-office to state-office
document exchange**. It transmits packets between two ICPC central offices. It is not
family-facing and it does not evaluate packet correctness.

> NEICE made the pipe electronic. Nothing checks whether the packet is correct before it
> enters the pipe. A defective packet is denied, there is no appeal, and the family starts
> over while a child waits.

**This project is a pre-submission layer that feeds NEICE. It does not compete with NEICE.**

---

## What this is, precisely

Families do not file ICPC packets — the ICPC-100A is filed by the sending state agency.
Families are the origin of nearly all the underlying data but are not the filer. That
structural fact constrains the whole design.

| Actor | Role in the system |
|---|---|
| **Family** | Primary UI user. Supplies documents and narrative, works through the dependency graph, produces a complete family-side packet. |
| **Caseworker** | Second UI surface. Receives the assembled packet with all automated checks already run, reviews, exercises judgment, submits. |
| **Agency** | The buyer. State or federal agency directs families to the portal. |

**Value proposition:** replace unnecessary caseworker and legal burden with automated
verification, so that children in foster care are placed with good families faster.

---

## Deliverables

Nine deliverables, each with an explicit definition of done. Priority reflects the cut
order — **D1 and D4 are the project and are never cut.**

### D0 — The ontology
**The long pole. Build first.** A machine-readable requirements ontology for California and
Texas, both directions (CA→TX and TX→CA), as versioned JSON/YAML validated at boot with Zod.

Four object types: `Fact`, `Document`, `Requirement`, `ConsistencyRule`.

*Done when:* CA and TX requirement sets load and validate at boot; every `Requirement` and
`Document` carries a `source_citation` and a `verified` boolean; unsourced entries are
`verified: false` and render as unverified in the UI.

**Ontology data is the only state-specific thing in the system. No state logic in code.**

---

### D1 — Engine 1: Cross-document consistency ⭐ *never cut*
The highest-value engine. Most administrative defects are not missing documents — they are
documents that contradict each other.

Extract typed facts from every uploaded document, then evaluate `ConsistencyRule`s across
the fact graph. Every fact retains provenance (which document, which page, which field) so a
flagged contradiction traces back to both sources.

Rules in scope:
- Legal name consistent across application, marriage certificate, and government ID
- Residence address consistent across tax return, ID, and home study address
- Declared household size consistent with individuals appearing across medical forms and background clearances
- Employment history contains no unexplained gap
- Bedroom count supports the number of children requested
- Income declared on the application matches the tax return within tolerance

*Done when:* uploading the contradiction demo family produces a defect list in which each
item names **both** conflicting source documents and the rule violated.

---

### D2 — Engine 2: Validity clocks against the 180-day window
Background checks, fingerprint clearances, medical exams, TB tests, and safety inspections
all expire. The ICPC decision window runs up to 180 calendar days. Documents routinely lapse
mid-process and the family finds out at month five.

Given each document's issue date and its state-specific `validity_period_days`, compute which
items expire before the projected decision date and when each must be renewed.

*Done when:* a timeline renders against the 180-day clock, at-risk items are visually
flagged, and each carries a renewal action with a deadline. **This is a temporal reasoning
feature, not a form — it is visually central.**

---

### D3 — Engine 3: Dependency graph and critical path ⭐ *never cut*
**The primary UI.** Not sequential screens.

Build a DAG from `Requirement.depends_on` edges — derived, never hand-authored. Compute the
critical path using `external_turnaround_days` (fingerprint processing, agency scheduling)
and output the optimal ordering plus the earliest achievable submission date.

UX requirements:
- Graph expands downward; nodes connect to downstream nodes
- Node states: `locked`, `available`, `in-progress`, `complete`, `defect`
- Clicking a node opens a requirement panel: the checklist of inputs needed, the source citation, verification status
- When all inputs are present, an **Automate** action appears — it runs extraction, populates facts, runs the relevant `ConsistencyRule`s, and on success marks the node complete and unlocks downstream nodes
- Critical path nodes visually distinguished from slack nodes
- Auto-layout via dagre or elkjs — no hand-positioning

*Done when:* the graph derives from ontology edges alone, the critical path is highlighted,
and Automate advances a node end-to-end on a synthetic family.

---

### D4 — Engine 4: State-pair requirements delta
Given a sending and receiving state, compute the diff over the `Requirement` set: which
receiving-state requirements have no sending-state equivalent, which have a stricter
threshold, which use a different form.

CA and TX are chosen because the regimes are structurally different — California uses
Resource Family Approval as a unified process, Texas uses DFPS home screening and licensing.
The delta between them is where families get surprised.

*Done when:* a comparison view renders the machine-computed CA↔TX diff with citations.

---

### D5 — Extraction pipeline
Document → typed facts, with provenance. Anthropic API (Claude with vision) for extraction;
per-document-type prompts.

*Done when:* an uploaded document yields typed facts, each carrying document ID, page, and
field provenance, plus a confidence value.

---

### D6 — Voice/chat intake
Structured interview populating factual and autobiographical fields, producing a draft the
caseworker edits. Removes transcription burden; makes no assessments.

Browser `SpeechRecognition` for STT and `SpeechSynthesis` for TTS to avoid extra infra.

> **A text-chat fallback ships unconditionally.** Browser speech APIs fail unpredictably on
> conference wifi, and a failed voice demo on stage is a catastrophic loss.

*Done when:* both voice and text paths populate the same fields, every field is tagged with
provenance `interview`, and all are flagged for human review in the caseworker view.

---

### D7 — Caseworker review surface
The assembled packet with all automated checks already run, ready for human judgment.

*Done when:* a caseworker can view the packet, see every defect with its citation, see every
interview-sourced field flagged for review, and act.

---

### D8 — Synthetic demo families
Three families in `/demo/families`: clean, contradiction, expiring. All synthetic.

*Done when:* each family drives its demo beat end-to-end without manual setup.

---

### D9 — Impact model (`docs/IMPACT.md`)
Bottom-up quantification with every assumption stated, conservative and aggressive scenarios
rather than a single number, and parameters adjustable in the UI so a judge can change an
assumption and watch the total move.

**Leads with child-days, not dollars.** Dollars are the secondary number.

*Done when:* the model is documented, each parameter is sourced or explicitly bounded as an
assumption, and the addressable-denial fraction is presented as a range with the bounding
reasoning stated.

---

### Cut order if behind

```
CUT FIRST →  D6 voice intake (fall back to text chat)
             D4 state-pair delta
             D7 caseworker surface
NEVER CUT →  D1 consistency engine, D3 dependency graph
```

---

## Hard boundaries

These are not style preferences. Crossing any of them loses the project.

1. **No substantive assessment.** The system never judges whether a family is fit. The home
   study narrative is a clinical judgment made by a licensed social worker. We check
   completeness, consistency, validity, and sequencing only. If a family is genuinely
   unsuitable, the human process must still catch that — we must not obscure it.

2. **No learned model on denial outcomes.** There is no public corpus of ICPC denial records.
   The defect taxonomy is hand-built from published requirement text and documented denial
   reasons, and is agency-editable. AI performs verification at runtime; **the rules are
   authored, not learned.** Never claim otherwise.

3. **No real PII.** All demo data is synthetic. Never accept or store a real person's records.

4. **No invented requirements.** If a CA or TX requirement is not sourced from an actual state
   document, it is marked `"verified": false` and surfaced in the UI as unverified.
   *Fabricated regulatory content is the single fastest way to lose this.*

5. **UI framing is decision-support for caseworker review, not an approval decision.**

---

## Architecture

Four engines over one ontology. The portal is the surface; **the engines are the product.**

Documents are extracted into canonical typed facts, and everything else operates on facts
rather than on documents.

```
Fact              canonical variable extracted from documents or intake
                  id, type, value, provenance[], confidence, extracted_at

Document          an artifact the family provides
                  id, type, states_accepted, issue_date, validity_period_days,
                  yields_facts[], external_turnaround_days, source_citation, verified

Requirement       an obligation imposed by a state
                  id, state, direction (sending|receiving), applies_to,
                  satisfied_by_documents[], satisfied_by_facts[], depends_on[],
                  source_citation, verified

ConsistencyRule   an assertion that must hold across facts
                  id, expression, facts_involved[], severity, defect_message,
                  source_citation
```

- `depends_on` edges on `Requirement` produce the dependency graph — derived, not authored
- `external_turnaround_days` drives critical path computation
- `validity_period_days` drives the expiration engine
- `source_citation` + `verified` on every `Requirement` and `Document` is what separates
  this from a checklist app

### Stack

Chosen for 26 hours and single-command deploy. One repo, one deploy target, no
microservices, no separate backend.

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Deploy | Vercel, custom domain |
| UI | Tailwind + shadcn/ui |
| Graph | React Flow; dagre or elkjs for auto-layout |
| Data | Supabase (Postgres + auth + file storage) |
| Schema | Prisma or Drizzle |
| Validation | Zod, at boot |
| AI | Anthropic API (Claude with vision) — extraction and interview only |
| Charts | Recharts for the 180-day timeline, if custom SVG proves slow |

---

## Repository layout

```
/ontology          Versioned requirement data — the product
  /ca              California requirements, documents, rules
  /tx              Texas requirements, documents, rules
  /shared          Federal ICPC requirements, canonical fact types
  schema.ts        Zod schemas for all four object types
/engines
  consistency.ts   Engine 1 — cross-document consistency
  validity.ts      Engine 2 — validity clocks
  graph.ts         Engine 3 — DAG construction + critical path
  delta.ts         Engine 4 — state-pair delta
/extraction
  pipeline.ts      document → typed facts, with provenance
  /prompts         extraction prompts per document type
/app
  /family          intake portal, dependency graph UI
  /caseworker      assembled packet review
  /api
/demo
  /families        synthetic families: clean, contradiction, expiring
/docs
  IMPACT.md        the quantification model
  SOURCES.md       citation ledger
  git-workflow.md  terminal reference for this repo
```

Every directory carries its own `README.md` describing what belongs in it.

---

## Build phases

**Hard constraint: 26 hours.** 10:00 Saturday → 12:00 Sunday.

Before the event, research and data collection only — **confirm DNHacks rules on what is
permitted in advance before writing any code.** Sourcing and encoding the CA and TX
requirement data is the long pole and cannot be compressed. Every requirement needs a citation.

| Hours | Work |
|---|---|
| 0–2 | Scaffold, Supabase, ontology schemas, load and validate seed data |
| 2–6 | Extraction pipeline: document upload → typed facts with provenance |
| 6–10 | Engine 1 (consistency) and Engine 2 (validity clocks) |
| 10–16 | Engine 3: DAG construction, critical path, React Flow UI with node panels and Automate |
| 16–19 | Engine 4 (delta view) and caseworker review surface |
| 19–22 | Voice/chat intake with text fallback |
| 22–24 | Synthetic demo families, deploy to domain, IMPACT.md |
| 24–26 | Rehearse demo. **Freeze code at hour 24.** |

---

## Demo script

Three synthetic families, in this order:

1. **Clean path** — family completes intake, graph unlocks progressively, submission-ready
   date computed. Shows the happy path and critical path ordering.
2. **Cross-document contradiction** — address on the tax return does not match the home study
   address. Engine 1 catches it, names both source documents, cites the rule.
   *This is the money shot. Make it unmissable.*
3. **Expiration risk** — a fingerprint clearance lapses at day 140 of the 180-day window. The
   timeline shows the lapse; the system surfaces the renewal action and deadline.

Close on the state-pair delta view for CA → TX.

---

## Current status

| Area | State |
|---|---|
| Repository scaffold | ✅ Complete — folders, docs, READMEs |
| Pseudocode sketches | ✅ Complete — all marked `PSEUDOCODE — NOT IMPLEMENTED` |
| Ontology data (CA/TX) | ❌ Not started — **the long pole, do this first** |
| All four engines | ❌ Not started |
| Extraction pipeline | ❌ Not started |
| Next.js app | ❌ Not scaffolded — no `package.json` yet |
| Supabase | ❌ Not provisioned |

**No source file in this repository executes.** Files under `/engines`, `/extraction`, and
`/ontology/schema.ts` contain comment-only design sketches. Each opens with a banner:

```
PSEUDOCODE — NOT IMPLEMENTED
```

Replace the banner with real code as you implement. Grep for remaining sketches at any time:

```bash
grep -rn "PSEUDOCODE — NOT IMPLEMENTED" --include="*.ts" .
```

---

## Getting started

```bash
git clone git@github.com:<your-username>/icpc-compliance-engine.git
cd icpc-compliance-engine
```

Then read, in order:

1. [`CLAUDE.md`](CLAUDE.md) — the full standing brief. Read fully before writing code.
2. [`docs/git-workflow.md`](docs/git-workflow.md) — clone, branch, commit, merge, PR, and recovery commands.
3. [`docs/SOURCES.md`](docs/SOURCES.md) — the citation ledger and the no-invented-requirements rule.
4. [`ontology/README.md`](ontology/README.md) — start here for actual work. The ontology is the product.

---

## Engineering principles

1. **The ontology is the product.** If the graph is beautiful and the requirement data is thin, we lose. Weight effort accordingly.
2. **Provenance everywhere.** Every fact traces to a document and page. Every requirement traces to a citation.
3. **Deterministic where possible.** Consistency rules, validity math, and critical path are deterministic code. AI is for extraction and interview only. Do not put an LLM in the decision path where arithmetic will do.
4. **Nothing invented.** Unsourced requirement → `verified: false` → visible in UI.
5. **Demo-first.** At every checkpoint the app runs end-to-end on at least one synthetic family. Never leave it broken overnight.
6. **Freeze at hour 24.** Two hours of rehearsal beats one more feature.
