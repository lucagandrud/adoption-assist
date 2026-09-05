# Project Brief: ICPC Pre-Submission Compliance Engine

This file is the standing context for this repository. Read it fully before writing code.

---

## 1. What this is

A pre-submission compliance engine for interstate foster care and adoption placements
under the Interstate Compact on the Placement of Children (ICPC), built for DNHacks
in a 26-hour window.

**One-line description:**
A family-facing intake portal backed by a machine-readable requirements ontology
that catches packet defects, expiration risks, and sequencing errors before an ICPC
packet reaches a caseworker, so that submissions are correct on the first attempt.

**Value proposition:**
Replace unnecessary caseworker and legal burden with automated verification, so that
children in foster care are placed with good families faster.

---

## 2. Context: DNHacks

DNHacks is a selective, cross-campus hackathon oriented around building technology for
American industrial, military, and technological strength. Judges are from industry and
the public sector, including partners in the federal administration who are actively
recruiting engineers to modernize government systems. Prizes include cash, project
grants, interviews with partner organizations, and placement into a year-round cohort.

**Our category: Health and Public Service** (presented by Clearview AI).
Category framing: modernize how government serves Americans; government healthcare
systems and federal workflows touch hundreds of millions of people but lag far behind
modern software standards.

**Explicit judging criteria for this category:**
1. Technical quality
2. Potential to reduce costs for taxpayers
3. Improvement to the experience of interacting with government

Implication for engineering decisions: every feature must map to a defensible reduction
in time, cost, or error rate. Ship a working demo over a broad feature set.

**Hard constraint: 26 hours.** 10:00 Saturday to 12:00 Sunday.

---

## 3. The problem, with verified numbers

Any child placed across state lines for foster care or adoption must be approved under
the ICPC. The receiving state conducts a home study and approves or denies the placement.

Verified facts. Use these and only these; do not invent statistics.

| Fact | Value | Source |
|---|---|---|
| Annual ICPC home study requests | ~40,000 | Sankaran (2014), ABA Child Law Practice 33(6), Annie E. Casey Foundation study, 27 states responding |
| Denial rate | ~40% of ICPC placement requests | Sankaran (2014) |
| Tennessee denial rates, 6-year avg | 35% overall; 58% parents; 46.4% relatives | Sankaran (2014) |
| Regulatory decision window | Final approval or denial no later than **180 calendar days** from receipt of initial home study request | ICPC Regulations, AAICPC |
| Right of appeal | **None.** Only remedy is requesting review or filing a new ICPC request | ABA Section of Litigation, Children's Rights Committee |
| Caseworker paperwork burden | 4.3 hours per 8-hour day on documentation | OPRE (federal), published July 2025, data collected 2021–2022 |
| Children in foster care, FY2024 | 328,947 (6th consecutive annual decline) | AFCARS FY2024 |
| Legally free with adoption permanency plan, still in care | 34,817 | AFCARS FY2024 |
| Adoptions from foster care, FY2024 | 46,935 (lowest since 1999, down 26% since 2019) | AFCARS FY2024 |

**The gap we are filling.** NEICE (National Electronic Interstate Compact Enterprise)
already digitized ICPC. 47 states and jurisdictions are fully operational; the Family
First Prevention Services Act of 2018 requires all states to join by 2027. But NEICE is
**state-office to state-office document exchange**. It transmits packets between two ICPC
central offices. It is not family-facing and it does not evaluate packet correctness.

> NEICE made the pipe electronic. Nothing checks whether the packet is correct before it
> enters the pipe. A defective packet is denied, there is no appeal, and the family starts
> over while a child waits.

**Do not describe this project as competing with NEICE.** It is a pre-submission layer
that feeds NEICE.

---

## 4. Users and boundaries

**Structural fact that constrains the design:** families do not file ICPC packets. The
ICPC-100A is filed by the sending state agency. Families are the origin of nearly all the
underlying data (records, financials, narrative responses) but are not the filer.

Therefore:

- **Family (primary UI user):** supplies documents and narrative, works through the
  dependency graph, produces a complete family-side packet.
- **Caseworker (second UI surface):** receives the assembled packet with all automated
  checks already run, reviews, exercises judgment, submits.
- **Agency (buyer):** state or federal agency directs families to the portal.

### Hard boundaries — do not cross

1. **No substantive assessment.** The system never judges whether a family is fit. The
   home study narrative is a clinical judgment made by a licensed social worker. We check
   completeness, consistency, validity, and sequencing only. If a family is genuinely
   unsuitable, the human process must still catch that; we must not obscure it.
2. **No learned model on denial outcomes.** There is no public corpus of ICPC denial
   records. Sankaran had to request data from states and only 27 responded, with aggregate
   counts rather than case-level reasons. The defect taxonomy is hand-built from published
   requirement text and documented denial reasons, and is agency-editable. AI performs the
   verification at runtime; the rules are authored, not learned. Never claim otherwise.
3. **No real PII.** All demo data is synthetic. Generate fake families. Never accept or
   store a real person's records.
4. **No invented requirements.** If a California or Texas requirement is not sourced from
   an actual state document, mark it `"verified": false` and surface it in the UI as
   unverified. Fabricated regulatory content is the single fastest way to lose this.
5. **Framing in the UI:** decision-support for caseworker review, not an approval decision.

---

## 5. Scope

**Two states only: California and Texas.** Both directions (CA sending → TX receiving,
and TX sending → CA receiving).

These two are chosen because the regimes are structurally different: California uses
Resource Family Approval as a unified process; Texas uses DFPS home screening and
licensing. The delta between them is where families get surprised, and computing that
delta is a real result.

Architecture must generalize to 50 states. Only the ontology data is state-specific;
no state logic in code.

---

## 6. Architecture

Four engines over one ontology. The portal is the surface; the engines are the product.

### 6.1 The ontology (build this first — it is the long pole)

Palantir-style: documents are extracted into canonical typed facts, and everything else
operates on facts rather than on documents.

Four object types, stored as versioned JSON/YAML in `/ontology`, loaded and validated at
boot with Zod.

```
Fact           canonical variable extracted from documents or intake
               id, type, value, provenance[], confidence, extracted_at

Document       an artifact the family provides
               id, type, states_accepted, issue_date, validity_period_days,
               yields_facts[], external_turnaround_days, source_citation, verified

Requirement    an obligation imposed by a state
               id, state, direction (sending|receiving), applies_to,
               satisfied_by_documents[], satisfied_by_facts[], depends_on[],
               source_citation, verified

ConsistencyRule  an assertion that must hold across facts
               id, expression, facts_involved[], severity, defect_message,
               source_citation
```

Design notes:
- `depends_on` edges on Requirement produce the dependency graph. Do not hand-author a
  graph; derive it.
- `external_turnaround_days` (fingerprint processing, agency scheduling) drives critical
  path computation.
- `validity_period_days` on Document drives the expiration engine.
- Every Requirement and Document carries `source_citation` and `verified`. The UI
  displays the citation. This is what separates us from a checklist app.

### 6.2 Engine 1 — Cross-document consistency

The highest-value engine. Most administrative defects are not missing documents; they are
documents that contradict each other.

Extract typed facts from every uploaded document, then evaluate ConsistencyRules across
the fact graph. Each fact retains provenance (which document, which page, which field) so
a flagged contradiction can be traced to both sources.

Example rules to implement:
- Legal name consistent across application, marriage certificate, and government ID
- Residence address consistent across tax return, ID, and home study address
- Declared household size consistent with the count of individuals appearing across
  medical forms and background clearances
- Employment history contains no unexplained gap
- Bedroom count supports the number of children requested
- Income declared on the application matches the tax return within tolerance

Output: defect list, each item naming both conflicting sources and the rule violated.

### 6.3 Engine 2 — Validity clocks against the 180-day window

Background checks, fingerprint clearances, medical exams, TB tests, and safety
inspections all expire. The ICPC decision window runs up to 180 calendar days. Documents
routinely lapse mid-process and the family finds out at month five.

Given each document's issue date and its state-specific `validity_period_days`, compute
which items will expire before the projected decision date, and when each must be
renewed. Render as a timeline against the 180-day clock. Surface a renewal action on any
item at risk.

This is a temporal reasoning feature, not a form. Make it visually central.

### 6.4 Engine 3 — Dependency graph and critical path

The primary UI. Not sequential screens.

Build a DAG from Requirement `depends_on` edges. Compute the critical path using
`external_turnaround_days`, and output the optimal ordering plus earliest achievable
submission date.

UX specification:
- Graph expands downward; nodes connect to downstream nodes
- Node states: locked, available, in-progress, complete, defect
- Clicking a node opens its requirement panel showing the checklist of inputs needed
  (e.g. tax form, marriage certificate, AI voice interview), the source citation, and
  a verification status
- When all inputs for a node are present, an **Automate** action becomes available:
  it runs extraction, populates facts, runs the relevant ConsistencyRules, and on
  success marks the node complete and unlocks downstream nodes
- Critical path nodes visually distinguished from slack nodes
- Auto-layout via dagre or elkjs; do not hand-position

### 6.5 Engine 4 — State-pair requirements delta

Given a sending and receiving state, compute the diff over the Requirement set:
which receiving-state requirements have no sending-state equivalent, which have a
stricter threshold, which use a different form.

"Here is the machine-computed diff between two state regimes" is a stronger claim than
"here is a checklist." Render it as a comparison view.

### 6.6 Voice/chat intake

Structured interview that populates factual and autobiographical fields, producing a
draft the caseworker edits. Removes transcription burden; does not make assessments.

Use browser SpeechRecognition for STT and SpeechSynthesis for TTS to avoid extra infra.
**Always ship a text-chat fallback** — browser speech APIs fail unpredictably on
conference wifi and a failed voice demo on stage is a catastrophic loss.

Every field produced by intake is tagged with provenance `interview` and flagged for
human review in the caseworker view.

---

## 7. Stack

Chosen for 26 hours and single-command deploy.

- **Next.js (App Router) + TypeScript**, deployed to **Vercel** with a custom domain
- **Tailwind + shadcn/ui**
- **React Flow** for the dependency graph; **dagre** or **elkjs** for auto-layout
- **Supabase**: Postgres + auth + file storage in one
- **Prisma** or Drizzle for schema
- **Zod** for ontology validation at boot
- **Anthropic API** (Claude with vision) for document extraction and the interview
- **Recharts** for the 180-day timeline if a custom SVG proves slow

Everything in one repo, one deploy target. No microservices, no separate backend.

---

## 8. Repository layout

```
/ontology
  /ca              California requirements, documents, rules
  /tx              Texas requirements, documents, rules
  /shared          federal ICPC requirements, canonical fact types
  schema.ts        Zod schemas for all four object types
/engines
  consistency.ts   Engine 1
  validity.ts      Engine 2
  graph.ts         Engine 3 (DAG construction + critical path)
  delta.ts         Engine 4
/extraction
  pipeline.ts      document → typed facts, with provenance
  prompts/         extraction prompts per document type
/app
  /family          intake portal, dependency graph UI
  /caseworker      assembled packet review
  /api
/demo
  families/        synthetic families: clean, contradiction, expiring
/docs
  IMPACT.md        the quantification model
```

---

## 9. Build phases

**Before the event** (research and data collection only — confirm DNHacks rules on what
is permitted in advance before writing any code):
Source and encode the CA and TX requirement data. This is the long pole and the thing
that cannot be compressed. Every requirement needs a citation.

| Hours | Work |
|---|---|
| 0–2 | Scaffold, Supabase, ontology schemas, load and validate seed data |
| 2–6 | Extraction pipeline: document upload → typed facts with provenance |
| 6–10 | Engine 1 (consistency) and Engine 2 (validity clocks) |
| 10–16 | Engine 3: DAG construction, critical path, React Flow UI with node panels and Automate action |
| 16–19 | Engine 4 (delta view) and caseworker review surface |
| 19–22 | Voice/chat intake with text fallback |
| 22–24 | Synthetic demo families, deploy to domain, IMPACT.md |
| 24–26 | Rehearse demo. Freeze code at hour 24. |

**Cut order if behind:** voice intake first (fall back to text chat), then Engine 4,
then the caseworker surface. Never cut Engine 1 or the graph — those are the project.

---

## 10. Demo script

Three synthetic families, in this order:

1. **Clean path.** Family completes intake, graph unlocks progressively, submission-ready
   date computed. Shows the happy path and the critical path ordering.
2. **Cross-document contradiction.** Address on the tax return does not match the home
   study address. Engine 1 catches it, names both source documents, cites the rule.
   This is the money shot; make it unmissable.
3. **Expiration risk.** A fingerprint clearance will lapse at day 140 of the 180-day
   window. Timeline shows the lapse, system surfaces the renewal action and the deadline.

Close on the state-pair delta view for CA → TX.

---

## 11. Impact quantification (`/docs/IMPACT.md`)

Build bottom-up. State every assumption. Provide conservative and aggressive scenarios
rather than a single number.

```
40,000 annual ICPC home study requests
  × ~40% denial rate                        = ~16,000 denials/year
  × [administratively-defective fraction]   = addressable denials
  × [additional days in care per denial]    = excess child-days
  × [per-child-day cost of foster care]     = taxpayer cost
```

**Be honest about the second line.** Many denials are substantive (unsafe home, failed
background check) and are not addressable by this system, nor should they be. Bound the
addressable fraction with a range and say you are bounding it. Source the per-child-day
cost; do not assert it.

**Lead with child-days, not dollars.** "X thousand additional child-days in foster care
per year caused by preventable packet defects" lands harder in this category than a
dollar figure alone. Dollars are the secondary number.

Make the parameters adjustable in the UI so a judge can change an assumption and watch
the total move. Being able to say "here is the number if you think our middle assumption
is too generous" is worth more than the number itself.

---

## 12. Engineering principles

1. **The ontology is the product.** If the graph is beautiful and the requirement data is
   thin, we lose. Weight effort accordingly.
2. **Provenance everywhere.** Every fact traces to a document and page. Every requirement
   traces to a citation. This is what makes it credible rather than a demo.
3. **Deterministic where possible.** Consistency rules, validity math, and critical path
   are deterministic code. AI is used for extraction and interview only. Do not put an
   LLM in the decision path where arithmetic will do.
4. **Nothing invented.** Unsourced requirement → `verified: false` → visible in UI.
5. **Demo-first.** At every checkpoint the app must run end-to-end on at least one
   synthetic family. Never leave it broken overnight.
6. **Freeze at hour 24.** Two hours of rehearsal beats one more feature.
