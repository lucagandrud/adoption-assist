/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * =============================================================================
 * Nothing in this file executes. There are no imports, no exports, and no
 * runnable statements — only a commented design sketch.
 *
 * File:    engines/consistency.ts
 * Purpose: Engine 1 — cross-document consistency. Evaluate ConsistencyRules
 *          across the fact graph and emit defects that name BOTH conflicting
 *          sources.
 * Owner:   unassigned
 * Phase:   Hours 6–10
 * Status:  ⭐ NEVER CUT. With Engine 3, this is the project.
 *
 * Demo beat #2 depends entirely on this file — the tax-return address vs.
 * home-study address contradiction. That is the money shot.
 * ============================================================================= */

// ---------------------------------------------------------------------------
// WHY THIS IS THE HIGHEST-VALUE ENGINE
// ---------------------------------------------------------------------------
// Most administrative defects are not missing documents. They are documents
// that contradict each other. A checklist app cannot see these at all.
//
// ---------------------------------------------------------------------------
// OUTPUT SHAPE
// ---------------------------------------------------------------------------
//
// Defect           object:
//                    rule_id          string
//                    severity         Severity
//                    message          string    rendered from the template
//                    conflicting      ConflictSource[]   (min 2)
//                    citation         Citation  the rule's source
//
// ConflictSource   object:
//                    fact_id       string
//                    value         unknown   the actual conflicting value
//                    document_id   string?
//                    document_name string?   human label for the UI
//                    page          number?
//                    field         string?
//
// A defect with fewer than two conflicting sources is a bug. The whole point
// is that the family can see WHICH TWO papers disagree.
//
// ---------------------------------------------------------------------------
// MAIN ENTRY
// ---------------------------------------------------------------------------
//
// function runConsistencyChecks(facts, rules, ontology) -> Defect[]
//
//     index facts by fact type
//         → factsByType: Map<factTypeKey, Fact[]>
//
//     defects = []
//
//     for each rule in rules:
//
//         gather the facts this rule needs:
//             involved = rule.facts_involved.map(key => factsByType[key] ?? [])
//
//         if any required fact type has zero facts:
//             SKIP this rule — do not emit a defect
//             (absence is Engine 3's problem: it means an upstream node is
//              incomplete. Reporting it here would double-report and would
//              flood the family with noise on a half-filled packet.)
//
//         comparator = COMPARATOR_REGISTRY[rule.expression]
//         if comparator is undefined:
//             THROW at boot, not here — the registry check belongs in
//             loadOntology() referential integrity. Reaching this branch at
//             runtime means boot validation was skipped.
//
//         result = comparator(involved, rule)
//
//         if result.violated:
//             defects.push({
//                 rule_id:     rule.id,
//                 severity:    rule.severity,
//                 message:     render(rule.defect_message, result.bindings),
//                 conflicting: result.sources,   // >= 2, each with provenance
//                 citation:    rule.source_citation,
//             })
//
//     sort defects: blocking → warning → info
//     return defects
//
// ---------------------------------------------------------------------------
// COMPARATOR REGISTRY
// ---------------------------------------------------------------------------
// Deterministic functions, keyed by ConsistencyRule.expression. No LLM in
// this path — see CLAUDE.md principle #3. The rule SET is data; the
// comparators are code.
//
// Each comparator receives the fact groups and returns:
//     { violated: boolean, sources: ConflictSource[], bindings: object }
//
//   "names_match"
//       Normalize then compare legal name across application, marriage
//       certificate, government ID.
//       NORMALIZATION IS THE HARD PART, not the comparison:
//         - case and whitespace folding
//         - punctuation in hyphenated and apostrophe names
//         - middle name present in one document, absent in another
//             → NOT a conflict. Very common and legitimate.
//         - suffixes (Jr/Sr/III)
//             → NOT a conflict on its own.
//         - a genuinely different surname (maiden vs. married)
//             → IS a conflict, but a soft one. Severity should be warning,
//               not blocking, and the message should suggest the marriage
//               certificate as the reconciling document rather than accusing
//               the family of an error.
//       Bias toward false negatives here. A false positive on a name tells a
//       family their paperwork is wrong when it is fine, which is exactly the
//       experience this project exists to remove.
//
//   "addresses_match"
//       Residence address across tax return, ID, home study address.
//       Normalize: "St"/"Street", "Apt"/"#"/"Unit", ZIP+4 vs. 5-digit,
//       directionals ("N" vs "North"), casing.
//       ⚠️ A legitimate move mid-process produces a real mismatch. The defect
//       message must offer "we moved" as a resolution path, not just flag an
//       error. Consider comparing issue dates: if the tax return predates the
//       home study by a year, a move is the likely explanation.
//       DRIVES DEMO BEAT #2 — make this one solid before any other rule.
//
//   "household_size_consistent"
//       Declared household size vs. the count of DISTINCT individuals
//       appearing across medical forms and background clearances.
//       Distinctness is the hard part — the same person appears under
//       slightly different names across forms. Reuse names_match
//       normalization to dedupe before counting.
//       A newborn or a person who joined the household mid-process is a real
//       explanation. Severity: warning.
//
//   "employment_no_unexplained_gap"
//       Sort employment facts by start date, walk the sequence, flag gaps
//       exceeding a threshold that carry no explanation fact.
//       THRESHOLD MUST COME FROM THE ONTOLOGY, not a constant here — it is
//       plausibly state-specific and hardcoding it puts state logic in code.
//
//   "bedrooms_support_child_count"
//       Bedroom count vs. number of children requested.
//       The actual occupancy rule (children per bedroom, same-sex sharing,
//       age cutoffs) is STATE-SPECIFIC and lives in the ontology. This
//       comparator reads the threshold; it must not encode CA or TX policy.
//
//   "income_matches_tax_return"
//       Declared income vs. tax return, within a tolerance.
//       TOLERANCE FROM ONTOLOGY. Decide and document whether the comparison
//       is gross or AGI — these differ substantially and comparing across
//       them produces false defects on every self-employed family.
//
// ---------------------------------------------------------------------------
// FALSE-POSITIVE POSTURE
// ---------------------------------------------------------------------------
// This system tells families their paperwork is defective. A false positive
// causes real distress and real wasted effort, and it is the failure mode a
// judge is most likely to probe.
//
// When a comparator is uncertain, prefer `warning` over `blocking`, and write
// the defect message as a question ("these two documents show different
// addresses — did you move?") rather than an accusation.
//
// This engine NEVER assesses fitness. It reports that two papers disagree.
// It does not infer what the disagreement means about the family.
// (CLAUDE.md hard boundary #1.)
