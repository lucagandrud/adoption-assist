# Project Brief: ICPC Compliance Workbench

This file is the standing context for this repository. Read it fully before writing code.

> **Scope revision.** This project was originally specified with a family-facing intake
> portal and a caseworker review surface. **The family side is cut.** The system is
> caseworker-facing only and accepts no family-facing intake. If you find a reference to a
> family portal, a voice/chat interview, or family document upload anywhere in this
> repository, it is stale — fix it.

---

## 1. What this is

AI tooling for caseworkers handling interstate foster care and adoption placements under the
Interstate Compact on the Placement of Children (ICPC). Built for DNHacks in a 26-hour window.

**One-line description:**
A caseworker workbench that derives the correct document workflow from state regulations and
automatically verifies every uploaded document against them, so packets are correct before
they are filed.

**Value proposition:**
Interstate placement packets are rejected for administrative defects — a mismatched address,
a lapsed clearance, a document filed out of order. Each rejection costs caseworker hours and
adds months to a child's time in care. Automating the check makes the process **lower cost,
faster, and more accurate.**

---

## 2. Context: DNHacks

DNHacks is a selective, cross-campus hackathon oriented around building technology for
American industrial, military, and technological strength. Judges are from industry and the
public sector, including partners in the federal administration who are actively recruiting
engineers to modernize government systems.

**Our category: Health and Public Service** (presented by Clearview AI).

**Explicit judging criteria:**
1. Technical quality
2. Potential to reduce costs for taxpayers
3. Improvement to the experience of interacting with government

Every feature must map to a defensible reduction in time, cost, or error rate. Ship a working
demo over a broad feature set.

**Hard constraint: 26 hours.** 10:00 Saturday to 12:00 Sunday.

---

## 3. The problem, with verified numbers

Any child placed across state lines for foster care or adoption must be approved under the
ICPC. The receiving state conducts a home study and approves or denies the placement.

Use these and only these; do not invent statistics.

| Fact | Value | Source |
|---|---|---|
| Annual ICPC home study requests | ~40,000 | Sankaran (2014), ABA *Child Law Practice* 33(6); Annie E. Casey Foundation study, 27 states responding |
| Denial rate | ~40% of ICPC placement requests | Sankaran (2014) |
| Tennessee denial rates, 6-year avg | 35% overall; 58% parents; 46.4% relatives | Sankaran (2014) |
| Regulatory decision window | Final approval or denial no later than **180 calendar days** from receipt of initial home study request | ICPC Regulations, AAICPC |
| Right of appeal | **None.** Only remedy is requesting review or filing a new ICPC request | ABA Section of Litigation, Children's Rights Committee |
| Caseworker paperwork burden | 4.3 hours per 8-hour day on documentation | OPRE (federal), published July 2025, data collected 2021–2022 |
| Children in foster care, FY2024 | 328,947 (6th consecutive annual decline) | AFCARS FY2024 |
| Legally free with adoption permanency plan, still in care | 34,817 | AFCARS FY2024 |
| Adoptions from foster care, FY2024 | 46,935 (lowest since 1999, down 26% since 2019) | AFCARS FY2024 |

**The gap we are filling.** NEICE (National Electronic Interstate Compact Enterprise) already
digitized ICPC. 47 states and jurisdictions are fully operational; the Family First Prevention
Services Act of 2018 requires all states to join by 2027. But NEICE is **state-office to
state-office document exchange**. It transmits packets between two ICPC central offices. It
does not evaluate packet correctness.

> NEICE made the pipe electronic. Nothing checks whether the packet is correct before it
> enters the pipe. A defective packet is denied, there is no appeal, and the case starts over
> while a child waits.

**Do not describe this project as competing with NEICE.** It is a pre-submission layer that
feeds NEICE.

---

## 4. Users and scope

**Caseworker is the only user.** There is no family-facing surface.

| Actor | Role |
|---|---|
| **Caseworker** | The user. Assembles the packet, uploads documents, works the workflow, resolves defects, files. |
| **Agency** | The buyer. State or federal child welfare agency. |

### Why the family side is cut

1. **We do not want to handle family data upload.** No consumer intake means no consumer PII
   in the threat model, which is the right posture for a 26-hour build with no compliance
   review.
2. **Families are not the filer anyway.** The ICPC-100A is filed by the sending state agency.
   Building a portal for them modeled a user who cannot submit.
3. **Focus.** Two features built well beat six built thinly.

Caseworkers already hold these records. The workbench operates on what the agency has.

### Scope: two states

**California and Texas**, both directions (CA sending → TX receiving, and TX sending → CA
receiving).

Chosen because the regimes are structurally different: California uses Resource Family
Approval as a unified process; Texas uses DFPS home screening and licensing. The composed
workflow genuinely differs by direction rather than being a relabeled checklist.

Architecture must generalize to 50 states. **Only ontology data is state-specific; no state
logic in code.**

---

## 5. Product flow

```
sign in
  └─ select case
       └─ select state pair + direction        CA ⇄ TX
            └─ WORKFLOW DASHBOARD
                 ├─ branching document graph derived from both states' regulations
                 ├─ upload a document → extract → ontologize → verify
                 └─ green check when an item passes; defect when it does not
```

**The state pair composes the workflow.** The applicable requirement set resolves from the
sending state's sending-direction requirements, the receiving state's receiving-direction
requirements, and the federal baseline. The dependency graph is derived from that set.
Flipping the direction must produce a visibly different workflow — if it does not, the
ontology is too thin.

---

## 6. The two core features

Everything else is foundation, shell, or deferred.

### F1 — Workflow dashboard

The primary UI. A branching, stepwise document workflow **derived from regulation data, never
hand-authored.**

- DAG built from `Requirement.depends_on` edges. If anyone writes a literal node/edge list, that is the bug.
- Node states: `locked`, `available`, `in_progress`, `verified`, `defect`
- Clicking a node opens its panel: required inputs, governing citation, verification status
- Critical path computed from `external_turnaround_days`, distinguished from slack
- Auto-layout via dagre or elkjs — never hand-position

### F2 — AI verification with green checks

Upload → extract → ontologize → check → green check or defect.

The checks that matter are the small ones that get packets rejected:

| Check | Example defect |
|---|---|
| Cross-document consistency | Address on tax return ≠ address on home study |
| Name consistency | Legal name differs across ID, application, marriage certificate |
| Household size | Declared size ≠ individuals across medical forms and clearances |
| Income tolerance | Declared income ≠ tax return, outside tolerance |
| Field completeness | Required field blank or illegible |
| Document validity | Clearance expires before the projected decision date |

Every defect names **both** conflicting sources with page and field, plus the rule violated.

> A green check means the paperwork is consistent and complete. **It never means the family
> is approved.**

---

## 7. Architecture

Ontology at the center. Documents are extracted into canonical typed facts; every engine
operates on facts rather than on documents.

### Object types

Stored as versioned JSON/YAML in `/ontology`, loaded and validated at boot with Zod.

```
Fact              canonical typed value extracted from a document
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

**`Action` is what makes this an ontology rather than a schema.** `verify`, `flag`,
`override`, `request_renewal`, `mark_filed` are typed operations with preconditions and
recorded effects. An override becomes a first-class audited event with an author, not a
silently mutated field — which matters in a government workflow where someone will eventually
ask who changed what.

### Derivation rules

- `depends_on` → the workflow graph. Derived, never authored.
- `external_turnaround_days` → critical path
- `validity_period_days` → expiration risk
- `source_citation` + `verified` on every Requirement and Document → displayed in the UI.
  This is what separates this from a checklist app.

### Where AI sits

**Extraction only.** Claude with vision reads documents into typed facts with page-and-field
provenance. Consistency checks, date arithmetic, and graph derivation are deterministic code.

An LLM never decides whether a requirement is met. Do not put an LLM in the decision path
where arithmetic will do.

---

## 8. Stack

- **Next.js (App Router) + TypeScript**, deployed to **Vercel**
- **Tailwind + shadcn/ui**
- **React Flow** for the workflow graph; **dagre** or **elkjs** for auto-layout
- **Supabase**: Postgres + auth + file storage
- **Prisma** or Drizzle for schema
- **Zod** for ontology validation at boot
- **Anthropic API** (Claude with vision) for document extraction

One repo, one deploy target. No microservices, no separate backend.

---

## 9. Repository layout

```
/ontology
  /ca              California requirements, documents, rules
  /tx              Texas requirements, documents, rules
  /shared          federal ICPC requirements, canonical fact types, actions
  schema.ts        Zod schemas for all object types
/engines
  graph.ts         F1 — workflow DAG + critical path
  consistency.ts   F2 — cross-document verification
  validity.ts      expiration math (used by F2; timeline view deferred)
  delta.ts         state-pair resolution (used by F1; comparison view deferred)
/extraction
  pipeline.ts      document → typed facts, with provenance
  prompts/         extraction prompts per document type
/app
  /cases           case list, state pair + direction selection
  /workflow        the dashboard
  /api
/demo
  cases/           synthetic example case and documents
/docs
  IMPACT.md        quantification model
  SOURCES.md       citation ledger
```

---

## 10. Build phases

**Before the event** (research and data collection only — confirm DNHacks rules on what is
permitted in advance before writing any code): source and encode the CA and TX requirement
data. This is the long pole and cannot be compressed. Every requirement needs a citation.

| Hours | Work |
|---|---|
| 0–3 | Scaffold, Supabase, ontology schemas, load and validate seed data |
| 3–7 | Extraction pipeline: upload → typed facts with provenance |
| 7–12 | F1: state pair resolution, DAG derivation, critical path |
| 12–17 | F1: React Flow dashboard, node panels, branching UI |
| 17–21 | F2: consistency rules, verification loop, green-check states |
| 21–23 | Case shell (sign in, case selection), example case, synthetic documents |
| 23–24 | Deploy, IMPACT.md |
| 24–26 | Rehearse demo. Freeze code at hour 24. |

**Cut order if behind:** the deferred timeline view, then the deferred delta view, then auth
(hardcode a session and keep case selection). **Never cut F1 or F2** — those are the project.

---

## 11. Demo

One synthetic case, three beats:

1. **Workflow derivation.** Select the case and CA → TX. The branching workflow composes from
   regulation data with citations on the nodes. Flip to TX → CA and show it change.
2. **Verification.** Upload a clean document; it turns green with the rule and provenance shown.
3. **Defect.** Upload a document whose address contradicts the home study. The system names
   both source documents, the page and field, and the rule violated.
   *This is the money shot — make it unmissable.*

All documents synthetic. Cache extraction results behind a flag before hour 24 and rehearse
with the cache on; conference wifi fails and a hung API call during judging costs more than
the credit for doing it live.

---

## 12. Hard boundaries — do not cross

1. **No substantive assessment.** The system checks completeness, consistency, validity, and
   sequencing. It never judges whether a family is fit — that is a licensed social worker's
   clinical judgment. A green check means *the paperwork is consistent*, never *this family is
   approved*. If a family is genuinely unsuitable, the human process must still catch that; we
   must not obscure it.
2. **No learned model on denial outcomes.** There is no public corpus of ICPC denial records.
   The rules are authored from published requirement text and are agency-editable. AI performs
   extraction at runtime; the rules are authored, not learned. Never claim otherwise.
3. **No real records.** All demo data is synthetic. No family-facing intake, no real person's
   documents.
4. **No invented requirements.** Unsourced → `verified: false` → visible in the UI. Fabricated
   regulatory content is the single fastest way to lose this.
5. **Decision-support framing.** Supports caseworker review. Does not approve, deny, score, or
   rank.

---

## 13. Engineering principles

1. **The ontology is the product.** A beautiful graph over thin requirement data loses. Weight
   effort accordingly.
2. **Provenance everywhere.** Every fact traces to a document and page. Every requirement
   traces to a citation. This is what makes it credible rather than a demo.
3. **Deterministic where possible.** AI extracts; arithmetic decides.
4. **Nothing invented.** Unsourced requirement → `verified: false` → visible in UI.
5. **Demo-first.** At every checkpoint the app runs end-to-end on the example case. Never
   leave it broken overnight.
6. **Freeze at hour 24.** Two hours of rehearsal beats one more feature.
