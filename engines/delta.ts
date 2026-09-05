/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * =============================================================================
 * Nothing in this file executes. There are no imports, no exports, and no
 * runnable statements — only a commented design sketch.
 *
 * File:    engines/delta.ts
 * Purpose: Engine 4 — state-pair requirements delta (CA ↔ TX).
 * Owner:   unassigned
 * Phase:   Hours 16–19
 * Status:  Cut #2 if behind schedule.
 *
 * Closes the demo. "Here is the machine-computed diff between two state
 * regimes" is a much stronger claim than "here is a checklist."
 * ============================================================================= */

// ---------------------------------------------------------------------------
// WHY CA AND TX
// ---------------------------------------------------------------------------
// The regimes are structurally different, which is the point:
//   California — Resource Family Approval (RFA), a unified process
//   Texas      — DFPS home screening and licensing
// The delta is where families get surprised. Computing it is a real result.
//
// ---------------------------------------------------------------------------
// OUTPUT SHAPE
// ---------------------------------------------------------------------------
//
// DeltaKind    enum:
//                "only_in_receiving"   no sending-state equivalent — the
//                                      family will be surprised by this
//                "only_in_sending"     satisfied at home, not needed there
//                "stricter_threshold"  same obligation, tighter number
//                "different_form"      same obligation, different artifact
//                "equivalent"          matched, no material difference
//
// DeltaItem    object:
//                kind                 DeltaKind
//                sending_requirement  Requirement | null
//                receiving_requirement Requirement | null
//                explanation          string
//                threshold_delta      object | null   { field, from, to }
//                citations            Citation[]      BOTH sides
//                verified             boolean         false if EITHER side is
//
// DeltaReport  object:
//                sending_state    StateCode
//                receiving_state  StateCode
//                items            DeltaItem[]
//                surprise_count   number   count of only_in_receiving
//
// ---------------------------------------------------------------------------
// MAIN ENTRY
// ---------------------------------------------------------------------------
//
// function computeDelta(ontology, sendingState, receivingState, familyProfile)
//         -> DeltaReport
//
//     sendingReqs   = requirements where state == sendingState
//                     and direction == "sending"
//                     and applies_to matches familyProfile
//
//     receivingReqs = requirements where state == receivingState
//                     and direction == "receiving"
//                     and applies_to matches familyProfile
//
//     // shared/federal requirements are excluded — they are identical by
//     // definition and would pad the report with noise
//
//     pairs = matchRequirements(sendingReqs, receivingReqs)
//
//     for each pair:
//         both present  → classify (see below)
//         receiving only → "only_in_receiving"   ← THE VALUABLE CASE
//         sending only   → "only_in_sending"
//
//     sort: only_in_receiving first, then stricter_threshold, then the rest
//     return report
//
// ---------------------------------------------------------------------------
// THE HARD PART — MATCHING REQUIREMENTS ACROSS STATES
// ---------------------------------------------------------------------------
// CA and TX do not share requirement IDs, and matching on label text is
// fragile ("Home Study" vs "Home Screening" vs "RFA Written Report" are
// arguably the same obligation with three names).
//
// Options considered:
//
//   (a) Shared taxonomy key. Add an optional `equivalence_key` to Requirement.
//       Both states' entries for the same underlying obligation carry the same
//       key. Matching is then a trivial group-by.
//       + Deterministic, debuggable, zero runtime cost, no LLM in the path.
//       - Requires ontology authors to assign keys by hand.
//
//   (b) Match on satisfied_by_facts overlap. Two requirements are equivalent
//       if they produce substantially the same facts.
//       + No extra authoring.
//       - Fails when the same obligation is satisfied by differently-modeled
//         documents, which is exactly the CA/TX case.
//
//   (c) LLM-based semantic matching at runtime.
//       - Violates CLAUDE.md principle #3 (no LLM in the decision path where
//         deterministic code will do) and makes the demo non-reproducible.
//       REJECTED.
//
// RECOMMENDATION: (a), with (b) as a fallback that emits a LOW-CONFIDENCE
// match the UI labels as unconfirmed. Assigning equivalence_key is a handful
// of minutes of authoring for a two-state scope and it makes this engine
// nearly free to implement.
//
// ⚠️ Decide this while authoring the ontology, NOT at hour 16. If
// equivalence_key is not in the schema from the start, this engine gets cut.
//
// ---------------------------------------------------------------------------
// CLASSIFYING A MATCHED PAIR
// ---------------------------------------------------------------------------
//
// function classify(sendingReq, receivingReq) -> DeltaKind
//
//     compare numeric thresholds declared on each side
//         (validity_period_days on satisfying documents, income floors,
//          bedroom/occupancy limits, lookback periods on clearances)
//         if receiving is strictly tighter → "stricter_threshold"
//             record threshold_delta { field, from, to }
//
//     compare satisfying document types
//         if disjoint → "different_form"
//
//     otherwise → "equivalent"
//
// Direction matters: a threshold that is LOOSER in the receiving state is not
// a problem for the family and should classify as "equivalent" rather than
// cluttering the report. Only report the tightening.
//
// ---------------------------------------------------------------------------
// UI CONTRACT
// ---------------------------------------------------------------------------
// Two-column comparison view, sending state left, receiving state right.
//   - only_in_receiving rows highlighted — these are the surprises
//   - threshold deltas show both numbers side by side
//   - EVERY row displays both citations
//   - any row where either side is verified:false is badged unverified
//
// The headline number is surprise_count: "N requirements Texas imposes that
// California never asked you for."
