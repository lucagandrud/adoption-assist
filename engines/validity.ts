/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * =============================================================================
 * Nothing in this file executes. There are no imports, no exports, and no
 * runnable statements — only a commented design sketch.
 *
 * File:    engines/validity.ts
 * Purpose: Engine 2 — validity clocks against the 180-day ICPC decision window.
 * Owner:   unassigned
 * Phase:   Hours 6–10
 *
 * Drives demo beat #3: a fingerprint clearance lapses at day 140 of 180.
 * ============================================================================= */

// ---------------------------------------------------------------------------
// THE PROBLEM THIS SOLVES
// ---------------------------------------------------------------------------
// Background checks, fingerprint clearances, medical exams, TB tests, and
// safety inspections all expire. The ICPC decision window runs up to 180
// CALENDAR days (ICPC Regulations, AAICPC). Documents routinely lapse
// mid-process and the family finds out at month five — with no right of
// appeal, only the option to start over.
//
// This is a temporal reasoning feature, not a form. It is visually central.
//
// ---------------------------------------------------------------------------
// CALENDAR DAYS, NOT BUSINESS DAYS
// ---------------------------------------------------------------------------
// The 180-day window is calendar days. Do not apply business-day arithmetic
// to it.
//
// external_turnaround_days (Engine 3) is a DIFFERENT quantity — a lab or
// agency turnaround, which may well be business days. Do not conflate them.
// Whichever convention the ontology uses for turnaround, state it in the
// ontology docs and be consistent.
//
// ⚠️ TIMEZONE / DST: compute in whole calendar days on date-only values.
// Storing timestamps and subtracting milliseconds produces off-by-one errors
// across DST boundaries, and an off-by-one on a 180-day statutory deadline is
// exactly the kind of bug a judge would catch.
//
// ---------------------------------------------------------------------------
// OUTPUT SHAPE
// ---------------------------------------------------------------------------
//
// ValidityStatus   object:
//                    document_id       string
//                    document_name     string
//                    issue_date        date
//                    expires_on        date | null      null = never expires
//                    days_remaining    number | null
//                    state             enum:
//                                        "valid"        expires after decision
//                                        "at_risk"      expires within window
//                                        "expired"      already lapsed
//                                        "unknown"      missing issue_date
//                    renew_by          date | null      latest safe renewal
//                    lapses_on_day     number | null    day N of the 180
//
// ValidityReport   object:
//                    window_start      date
//                    window_end        date       window_start + 180 days
//                    projected_decision date
//                    items             ValidityStatus[]
//                    at_risk_count     number
//
// ---------------------------------------------------------------------------
// MAIN ENTRY
// ---------------------------------------------------------------------------
//
// function computeValidity(documents, ontology, windowStart, projectedDecision)
//         -> ValidityReport
//
//     window_end = addCalendarDays(windowStart, 180)
//
//     for each document the family has provided:
//
//         if document.validity_period_days is null:
//             state = "valid"; expires_on = null
//             CONTINUE   // e.g. a birth certificate does not expire
//
//         if document.issue_date is missing:
//             state = "unknown"
//             ⚠️ SURFACE THIS PROMINENTLY. An unknown expiry is more dangerous
//             than a known-soon expiry, because nobody is watching it. Do not
//             let it render as a quiet grey chip.
//             CONTINUE
//
//         validity_days = resolveValidityPeriod(document, receivingState)
//             // ⚠️ STATE-SPECIFIC. The same document type can carry a
//             // different validity period in CA than in TX. Resolve against
//             // the RECEIVING state's ontology — the receiving state runs the
//             // home study and its rules govern acceptance.
//             // If sending and receiving disagree, the stricter one binds.
//             // Engine 4 should surface that disagreement as a delta finding.
//
//         expires_on     = addCalendarDays(document.issue_date, validity_days)
//         days_remaining = calendarDaysBetween(today, expires_on)
//
//         if expires_on < today:                   state = "expired"
//         else if expires_on < projectedDecision:   state = "at_risk"
//         else:                                     state = "valid"
//
//         if state is "at_risk" or "expired":
//             lapses_on_day = calendarDaysBetween(windowStart, expires_on)
//
//             renew_by = expires_on - reissueTurnaround(document)
//                 // The family must START renewal before the lapse, by the
//                 // time it takes to obtain a replacement. A renewal deadline
//                 // equal to the expiry date is useless advice.
//                 // reissueTurnaround comes from external_turnaround_days.
//
//             if renew_by < today:
//                 ⚠️ ALREADY TOO LATE to renew without slipping the decision
//                 date. Say so explicitly and hand this to Engine 3 so the
//                 projected submission date moves. Silently showing a
//                 past-dated renewal deadline is worse than saying nothing.
//
//     at_risk_count = count of items in "at_risk" | "expired"
//     return report
//
// ---------------------------------------------------------------------------
// TIMELINE RENDERING (UI contract)
// ---------------------------------------------------------------------------
// Horizontal 180-day axis, day 0 → day 180.
//   - one lane per expiring document
//   - a bar from issue_date to expires_on
//   - a marker at projected_decision
//   - any bar ending BEFORE the decision marker renders in the alert color
//     with the renewal action attached
//
// Demo beat #3 is a fingerprint clearance lapsing at day 140 of 180. That bar
// must be unmistakable on a projector from the back of a room — test it on
// the actual screen before the demo, not on a laptop.
//
// Recharts is the fallback if a custom SVG proves slow (CLAUDE.md §7).
//
// ---------------------------------------------------------------------------
// OPEN QUESTION — where does projected_decision come from?
// ---------------------------------------------------------------------------
// Two candidates:
//   (a) windowStart + 180 (the statutory worst case)
//   (b) Engine 3's computed earliest achievable submission date + a typical
//       review duration
//
// (a) is conservative and flags more documents. (b) is more realistic but
// couples Engine 2 to Engine 3 and makes the report move when the graph
// changes.
//
// Recommendation: compute BOTH, show (a) as the default, and let the UI toggle.
// "Here is your risk under the statutory worst case, and here it is under our
// projected timeline" is a stronger demo than either number alone.
