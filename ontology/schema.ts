/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * =============================================================================
 * Nothing in this file executes. There are no imports, no exports, and no
 * runnable statements — only a commented design sketch.
 *
 * File:    ontology/schema.ts
 * Purpose: Zod schemas for the four ontology object types, validated at boot.
 * Owner:   unassigned
 * Phase:   Hours 0–2
 *
 * To implement: delete this banner, then write the real schemas below.
 * ============================================================================= */

// ---------------------------------------------------------------------------
// IMPORTS (when implementing)
// ---------------------------------------------------------------------------
//   z from "zod"
//
// ---------------------------------------------------------------------------
// PRIMITIVES
// ---------------------------------------------------------------------------
//
// StateCode        enum: "CA" | "TX"
//                  Deliberately narrow for the hackathon. Widening this enum
//                  must be the ONLY code change required to add a state.
//
// Direction        enum: "sending" | "receiving"
//
// Severity         enum: "blocking" | "warning" | "info"
//                  blocking → packet is not submission-ready
//                  warning  → caseworker should look, not a hard stop
//                  info     → surfaced but does not affect readiness
//
// Citation         object:
//                    text        string   human-readable citation, shown in UI
//                    url         string?  link to the source document
//                    retrieved   date?    when we pulled it
//
// ---------------------------------------------------------------------------
// PROVENANCE — the backbone of the credibility claim
// ---------------------------------------------------------------------------
//
// Provenance       object:
//                    source_kind   enum: "document" | "interview" | "manual"
//                    document_id   string?   present when source_kind=document
//                    page          number?   1-indexed page
//                    field         string?   field name on the form
//                    extracted_at  date
//
// NOTE: every Fact carries an ARRAY of provenance, not a single entry. The
// same fact (e.g. legal name) legitimately appears in several documents. When
// those disagree, Engine 1 needs BOTH provenance entries to name both sources
// in the defect message. A single-provenance model cannot express the defect.
//
// ---------------------------------------------------------------------------
// OBJECT 1 — Fact
// ---------------------------------------------------------------------------
//
// Fact             object:
//                    id            string
//                    type          string   canonical fact type key
//                    value         unknown  narrowed per fact type — see below
//                    provenance    Provenance[]   (min 1)
//                    confidence    number   0..1
//                    extracted_at  date
//
// OPEN QUESTION: `value` typing. Options considered —
//   (a) z.unknown() plus a per-fact-type validator table
//   (b) a discriminated union on `type`
// (b) is more correct; (a) is faster to write and lets ontology authors add
// fact types without touching code, which matches the no-state-logic-in-code
// principle. Leaning (a) with a registry in /ontology/shared.
//
// ---------------------------------------------------------------------------
// OBJECT 2 — Document
// ---------------------------------------------------------------------------
//
// Document         object:
//                    id                        string
//                    type                      string
//                    states_accepted           StateCode[]
//                    issue_date                date?
//                    validity_period_days      number?   null = never expires
//                    yields_facts              string[]  fact type keys
//                    external_turnaround_days  number?   wait to OBTAIN it
//                    source_citation           Citation
//                    verified                  boolean
//
// validity_period_days  → drives Engine 2 (expiration)
// external_turnaround_days → drives Engine 3 (critical path)
//
// ---------------------------------------------------------------------------
// OBJECT 3 — Requirement
// ---------------------------------------------------------------------------
//
// Requirement      object:
//                    id                      string
//                    state                   StateCode
//                    direction               Direction
//                    applies_to              string[]  e.g. relative, parent
//                    satisfied_by_documents  string[]  Document ids
//                    satisfied_by_facts      string[]  fact type keys
//                    depends_on              string[]  Requirement ids
//                    source_citation         Citation
//                    verified                boolean
//
// depends_on is the ONLY source of graph edges. Engine 3 derives the DAG from
// these. Never hand-author a node/edge list.
//
// ---------------------------------------------------------------------------
// OBJECT 4 — ConsistencyRule
// ---------------------------------------------------------------------------
//
// ConsistencyRule  object:
//                    id               string
//                    expression       string   see note below
//                    facts_involved   string[] fact type keys
//                    severity         Severity
//                    defect_message   string   template, names both sources
//                    source_citation  Citation
//
// DESIGN DECISION NEEDED on `expression`:
//   (a) a tiny declarative DSL parsed by the engine
//   (b) a key into a hand-written registry of comparator functions
// (b) is the 26-hour answer. It keeps rules deterministic and debuggable, and
// the rule SET still lives in data even though the comparators live in code.
// (a) risks spending hours on a parser during the build window.
//
// ---------------------------------------------------------------------------
// BOOT VALIDATION
// ---------------------------------------------------------------------------
//
// function loadOntology():
//     read every JSON/YAML file under /ontology/{shared,ca,tx}
//     parse each through its Zod schema
//     on failure → THROW, do not continue with partial data
//
//     then run referential integrity checks that Zod cannot express:
//       - every Requirement.depends_on id resolves to a real Requirement
//       - every satisfied_by_documents id resolves to a real Document
//       - every satisfied_by_facts / yields_facts / facts_involved key
//         resolves to a registered fact type
//       - the depends_on graph is ACYCLIC (a cycle means the family can
//         never start — fail loudly at boot, not at render)
//
//     collect and report every unverified entry so the UI can badge them
//     return the validated ontology
//
// Fail fast at boot. A malformed ontology must never reach the demo.
