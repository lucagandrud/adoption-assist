# Demo direction map

The demo now covers two directions: California sending a child to Texas, and Texas sending a child to California. Each direction uses a different subset of the requirement files. This document exists so Claude Code doesn't have to reconstruct that split by reading every requirement's `direction` and `state` field by hand — it's already done here, and re-generating it mechanically (a short script filtering by `state` + `direction`) is a good sanity check before trusting this list.

Every requirement below is `applies_to: ["relative"]`. Nothing in either list is receiving-side content for the wrong state, or sending-side content for the wrong state — this was checked programmatically (see the verification note at the bottom).

## Direction 1: California → Texas (CA sends, TX receives)

**File sources:**
- `ontology/ca/requirements/draft-sending-side.json` (10 requirements)
- `ontology/tx/requirements/draft-relative-placement.json` (20 requirements)
- `ontology/shared/requirements/draft-baseline.json` (5 federal requirements)

**Total: 35 requirements.**

California sending-side (root: `req-ca-sending-court-order`):
`req-ca-sending-court-order`, `req-ca-sending-icpc-packet-core-documents`, `req-ca-sending-fc3-afdc-fc-eligibility`, `req-ca-sending-financial-medical-plan`, `req-ca-sending-icpc-fact-sheet`, `req-ca-sending-icpc-100a-generation`, `req-ca-sending-expedited-3-day-timeline`, `req-ca-sending-regular-5-day-forwarding`, `req-ca-sending-icpc-100b-on-placement-or-status-change`, `req-ca-sending-post-placement-supervision`

Texas receiving-side (roots: `req-tx-age-marital-eval`, `req-tx-family-member-definition`, `req-tx-foster-home-capacity-unified`, `req-tx-foster-adoptive-home-screening-definition`):
`req-tx-age-marital-eval`, `req-tx-criminal-history-check-700`, `req-tx-family-member-definition`, `req-tx-foster-home-capacity-unified`, `req-tx-foster-adoptive-home-screening-definition`, `req-tx-home-screening-required-before-verification`, `req-tx-domestic-violence-history-disclosure`, `req-tx-home-screening-interviews`, `req-tx-home-visit-all-members-present`, `req-tx-single-spouse-verification-conditions`, `req-tx-screening-update-major-life-change`, `req-tx-verification-floorplan-photos`, `req-tx-verification-health-fire-inspection`, `req-tx-verification-certificate-capacity`, `req-tx-preservice-training-before-placement`, `req-tx-preservice-training-hours`, `req-tx-kinship-home-assessment`, `req-tx-kinship-minstandards-waiver`, `req-tx-weapons-firearms-storage`, `req-tx-child-own-bed`

Federal (shared by both directions): `req-federal-documentation-submission`, `req-federal-home-study-60-days`, `req-federal-icpc-100a-final-decision-180-days`, `req-federal-icpc-100b-already-placed-notice`, `req-federal-applicability-definitions` (context-only, not a checkable requirement)

**Confidence note:** California's sending-side content is sourced mostly from LA County DCFS policy (county-level, not statewide) — see the per-requirement source-type caveats in `draft-sending-side.json`. Texas's receiving-side content is the round-2-corrected 26 TAC minimum standards, statewide.

## Direction 2: Texas → California (TX sends, CA receives)

**File sources:**
- `ontology/tx/requirements/draft-sending-side.json` (13 requirements)
- `ontology/ca/requirements/draft-relative-placement.json` (35 requirements)
- `ontology/ca/requirements/draft-capacity-and-physical-environment.json` (12 requirements)
- `ontology/shared/requirements/draft-baseline.json` (5 federal requirements)

**Total: 65 requirements.**

Texas sending-side (root: `req-tx-sending-tmc-order`):
`req-tx-sending-tmc-order`, `req-tx-sending-icpc-packet-core-documents`, `req-tx-sending-psych-developmental-eval-conditional`, `req-tx-sending-icpc-cover-letter`, `req-tx-sending-financial-medical-form-103`, `req-tx-sending-regular-submission-15-days`, `req-tx-sending-tico-30-day-deadline`, `req-tx-sending-expedited-eligibility-and-3-day-submission`, `req-tx-sending-icpc-100a-generation`, `req-tx-sending-receiving-state-approval-required`, `req-tx-sending-pre-placement-notification-30-days`, `req-tx-sending-100b-generation-and-transmission-chain`, `req-tx-sending-post-placement-supervision`

California receiving-side (root: `req-ca-rfa-application-form-general`; capacity/physical-environment additions from the round-3 gap-closing pass):
`req-ca-background-check-general`, `req-ca-criminal-records-statement`, `req-ca-caci-check`, `req-ca-out-of-state-abuse-registry-check`, `req-ca-megans-law-check`, `req-ca-dmv-check`, `req-ca-laars-check`, `req-ca-lis-check`, `req-ca-criminal-record-clearance-required`, `req-ca-conviction-investigation-records`, `req-ca-clearance-blocked-pending-investigation`, `req-ca-disqualifying-convictions-no-exemption`, `req-ca-rap-back-enrollment`, `req-ca-criminal-exemption-request-process`, `req-ca-criminal-record-clearance-transfer`, `req-ca-home-health-safety-assessment`, `req-ca-fire-clearance-conditional`, `req-ca-home-physical-description-capacity`, `req-ca-psychosocial-interviews-applicant`, `req-ca-psychosocial-interviews-household-members`, `req-ca-psychosocial-interview-location`, `req-ca-psychosocial-financial-capacity`, `req-ca-psychosocial-criminal-history-discussion`, `req-ca-health-screening-physical`, `req-ca-tb-screening-all-adults`, `req-ca-pre-approval-training-hours`, `req-ca-pre-approval-training-icpc-timing-exception`, `req-ca-income-verification`, `req-ca-arc-funding-benefits-discussion`, `req-ca-rfa-application-form-general`, `req-ca-icpc-incoming-60-day-assessment`, `req-ca-icpc-100a-hold-until-approval`, `req-ca-emergency-placement-preconditions`, `req-ca-emergency-placement-application-deadline`, `req-ca-emergency-placement-full-assessment-90-days`, `req-ca-capacity-base-cap`, `req-ca-capacity-sibling-group-exception`, `req-ca-capacity-general-waiver`, `req-ca-relative-nrefm-financial-requirement-waiver`, `req-ca-sibling-placement-preference`, `req-ca-bedroom-sharing-limit`, `req-ca-bed-mattress-linen-standards`, `req-ca-bedroom-use-restrictions`, `req-ca-smoke-co-detectors`, `req-ca-pool-safety-conditional`, `req-ca-bathroom-standards`, `req-ca-general-home-condition`

Federal: same 5 as Direction 1.

**Confidence note:** Texas's sending-side content is sourced from the DFPS CPS Handbook, Chapter 4500 — a statewide official casework policy, not county-level, and the strongest-sourced sending-side file in this project. California's receiving-side content is the largest, most-worked file (round 1-3), cross-checked against WIC and 22 CCR directly for the capacity/physical-environment items — see `CLAUDE_CODE_HANDOFF.md` for the full confidence breakdown.

## What this means for `graph.ts`

If your dashboard renders one graph per active case, the case's direction (which state is sending, which is receiving) picks which requirement set above to load. Nothing in either list overlaps with the other except the 5 federal requirements, which apply regardless of direction. Both lists were verified to have no dependency cycles and no dangling references to documents or facts that don't exist in the registries (`documents/draft-documents.json`, `shared/fact-types.json`) as of this handoff — re-run that check after any further edits.

## Verification performed on this map

Generated by filtering each requirement file's own `id` list by `state` and `direction`, not retyped by hand — cross-checked against a corpus-wide script that also confirmed: no duplicate requirement ids across any file (95 total), no `depends_on` edge pointing to a nonexistent id, no dependency cycles, and no `satisfied_by_documents`/`satisfied_by_facts` reference pointing to an id missing from the documents or fact-types registries.
