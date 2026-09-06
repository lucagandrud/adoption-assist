# Dependency sequencing worksheet

Purpose: `depends_on` is what your `graph.ts` engine turns into the actual dashboard graph — per your own hard rule, it should never be hand-authored from a vibe. This worksheet groups all 72 requirements into their natural life-cycle phase, based on what the source citations actually say, so that whoever wires the real `depends_on` edges is choosing between a short list of defensible options within a phase, rather than staring at 72 flat entries and guessing.

I added exactly two new edges directly, because both are stated almost explicitly in the source text (not an inference):
- `req-ca-background-check-general` → depends on → `req-ca-rfa-application-form-general` (the application's own citation says it's literally the consent vehicle for the background check)
- The capacity chain already wired in round 3: `req-ca-capacity-general-waiver` → `req-ca-capacity-sibling-group-exception` → `req-ca-capacity-base-cap`

Everything else below is grouped, not chained — I'm not going to invent precise ordering between requirements just to make the graph look deeper. Where the source stated an order (Texas's training-before-placement, the ICPC 60-day-then-180-day sequence, the emergency-placement chain), that's already in the JSON files.

## Direction coverage — both demo directions now covered

Earlier rounds researched each state's **receiving**-side process only: what California requires when CA is receiving a child (47 requirements), and what Texas requires when TX is receiving a child (20 requirements). Christopher then confirmed the demo covers **both directions** — California sending to Texas, AND Texas sending to California — so both states now need a full receiving-side AND sending-side ruleset. Both gaps are now closed:

**California sending-side** (source: LA County DCFS policy + one statewide CDSS notice — see the source-type caveat in each entry, several of these are county-level implementation, not statewide regulation):

**Phase 0 — Court authorization (root)**
`req-ca-sending-court-order` (the signed juvenile court minute order)

**Phase 1 — Packet compilation** (parallel, all depend on Phase 0)
`req-ca-sending-icpc-packet-core-documents`, `req-ca-sending-fc3-afdc-fc-eligibility`, `req-ca-sending-financial-medical-plan`, `req-ca-sending-icpc-fact-sheet`

**Phase 2 — Filing**
`req-ca-sending-icpc-100a-generation` (depends on Phase 1), with the two county-specific timelines running alongside it: `req-ca-sending-expedited-3-day-timeline`, `req-ca-sending-regular-5-day-forwarding`

**Phase 3 — Post-placement**
`req-ca-sending-icpc-100b-on-placement-or-status-change` → `req-ca-sending-post-placement-supervision` (this last one is ongoing case management, not a pre-placement checklist item — see its own note on whether it fits your green-check model at all)

**Texas sending-side** (`tx/requirements/draft-sending-side.json`, 13 requirements) — source: DFPS CPS Handbook Chapter 4500, "Interstate Placements," a **statewide** official casework policy (a stronger source tier than California's county-level policy — no county caveat needed here), corroborated by the statewide DFPS ICPC Resource Guide:

**Phase 0 — Court authorization (root)**
`req-tx-sending-tmc-order` (the Temporary Managing Conservatorship order — TX is explicit an Emergency Order does not qualify)

**Phase 1 — Packet compilation** (parallel, all depend on Phase 0)
`req-tx-sending-icpc-packet-core-documents`, `req-tx-sending-psych-developmental-eval-conditional` (conditional: adoption-track or psychotropic medication), `req-tx-sending-icpc-cover-letter`, `req-tx-sending-financial-medical-form-103`

**Phase 2 — Filing** (two parallel tracks gated by `fact.placement.is_expedited_request`, same pattern as California)
Regular track: `req-tx-sending-regular-submission-15-days` → `req-tx-sending-tico-30-day-deadline`. Expedited track: `req-tx-sending-expedited-eligibility-and-3-day-submission` (this one has real eligibility criteria attached — see its citation and the open item in `fact-types.json`, the relationship+circumstance rule table isn't fully formalized yet). Both feed into `req-tx-sending-icpc-100a-generation`, followed by the hard legal gate `req-tx-sending-receiving-state-approval-required` (Texas is explicit that placing before this is a Class B misdemeanor — treat this like California's clearance-blocked-pending-investigation, a true blocker, not a soft check).

**Phase 3 — Placement & post-placement**
`req-tx-sending-pre-placement-notification-30-days` and `req-tx-sending-100b-generation-and-transmission-chain` both run off the approval gate, then `req-tx-sending-post-placement-supervision` (again, ongoing case management, same green-check caveat as California's).

**Deliberately out of scope in the TX sending-side file:** the non-custodial-parent placement pathway (DFPS CPS Handbook Section 4513), which can legally skip a full ICPC home study, and the disaster-relocation chapter (9000/9500 series). Both are real parts of Chapter 4500 but procedurally distinct from the kinship/relative ICPC pathway this project demos — see the trailing note in `draft-sending-side.json` (TX) if either becomes relevant later.

**Where things stand now:** both demo directions have a complete chain. CA→TX uses California sending (10 reqs) + Texas receiving (20 reqs) + federal (5 reqs) = 35. TX→CA uses Texas sending (13 reqs) + California receiving (47 reqs) + federal (5 reqs) = 65. See `docs/demo-direction-map.md` for the exact requirement-id lists per direction, built so you don't have to reconstruct this split by hand in Claude Code.

## California — receiving side (35 + 12 = 47 requirements)

**Phase 0 — Intake (root)**
`req-ca-rfa-application-form-general`

**Phase 1 — Background & criminal history screening** (all can run in parallel with each other once Phase 0 is done; no source states an order among them)
`req-ca-background-check-general` (→ Phase 0, wired), `req-ca-criminal-records-statement`, `req-ca-caci-check`, `req-ca-out-of-state-abuse-registry-check`, `req-ca-megans-law-check`, `req-ca-dmv-check`, `req-ca-laars-check`, `req-ca-lis-check`, `req-ca-criminal-record-clearance-required`, `req-ca-conviction-investigation-records`, `req-ca-clearance-blocked-pending-investigation` (→ conviction-investigation-records, wired), `req-ca-disqualifying-convictions-no-exemption`, `req-ca-rap-back-enrollment`, `req-ca-criminal-exemption-request-process`, `req-ca-criminal-record-clearance-transfer` (this last one is an *alternative* to the whole phase, not a step within it — it's for transferring an existing clearance rather than running a new one)

**Phase 2 — Home & physical environment**
`req-ca-home-health-safety-assessment`, `req-ca-fire-clearance-conditional`, `req-ca-home-physical-description-capacity`, `req-ca-capacity-base-cap`, `req-ca-capacity-sibling-group-exception` (wired), `req-ca-capacity-general-waiver` (wired), `req-ca-bedroom-sharing-limit`, `req-ca-bed-mattress-linen-standards`, `req-ca-bedroom-use-restrictions`, `req-ca-smoke-co-detectors`, `req-ca-pool-safety-conditional`, `req-ca-bathroom-standards`, `req-ca-general-home-condition` — these last 7 physical-standard items are almost certainly all checked in one site visit; I'd model them as siblings satisfied by the same inspection document rather than a chain.

**Phase 3 — Psychosocial assessment**
`req-ca-psychosocial-interviews-applicant`, `req-ca-psychosocial-interviews-household-members`, `req-ca-psychosocial-interview-location`, `req-ca-psychosocial-financial-capacity`, `req-ca-psychosocial-criminal-history-discussion`

**Phase 4 — Health, training, financial**
`req-ca-health-screening-physical`, `req-ca-tb-screening-all-adults`, `req-ca-pre-approval-training-hours`, `req-ca-pre-approval-training-icpc-timing-exception`, `req-ca-income-verification`, `req-ca-arc-funding-benefits-discussion`, `req-ca-relative-nrefm-financial-requirement-waiver`

**Cross-cutting — sibling placement**
`req-ca-sibling-placement-preference` (relevant whenever `fact.placement.is_sibling_group` is true; interacts with Phase 2's capacity exception, not a separate sequential phase)

**Phase 5 — Filing & decision** (this is genuinely sequential, already wired)
`req-ca-icpc-incoming-60-day-assessment` → `req-ca-icpc-100a-hold-until-approval`. Open question for you and Luca: does this phase depend on ALL of phases 1-4 being complete, or just some subset? The source doesn't spell this out beyond "Comprehensive Assessment" bundling psychosocial + training + background — a reasonable modeling choice is to make the Phase 5 assessment depend on Phases 1, 2, and 3, with Phase 4 items running in parallel. That's a judgment call, not a sourced fact — make it deliberately.

**Alternate track — emergency placement** (already wired: preconditions → application-deadline; full-assessment-90-days is a separate, later deadline on the same track)
`req-ca-emergency-placement-preconditions` → `req-ca-emergency-placement-application-deadline`, plus `req-ca-emergency-placement-full-assessment-90-days`

## Texas — receiving side (20 requirements)

**Phase 0 — Eligibility & definitions**
`req-tx-age-marital-eval`, `req-tx-family-member-definition`, `req-tx-foster-home-capacity-unified`, `req-tx-foster-adoptive-home-screening-definition`

**Phase 1 — Screening & background**
`req-tx-criminal-history-check-700`, `req-tx-home-screening-required-before-verification`, `req-tx-domestic-violence-history-disclosure`, `req-tx-home-screening-interviews`, `req-tx-home-visit-all-members-present`, `req-tx-single-spouse-verification-conditions`, `req-tx-screening-update-major-life-change` (already wired to single-spouse-verification-conditions)

**Phase 2 — Home verification / inspection**
`req-tx-verification-floorplan-photos`, `req-tx-verification-health-fire-inspection`, `req-tx-verification-certificate-capacity`, `req-tx-weapons-firearms-storage`, `req-tx-child-own-bed`

**Phase 3 — Training** (already wired: hours → before-placement)
`req-tx-preservice-training-hours` → `req-tx-preservice-training-before-placement`

**Phase 4 — Kinship-specific** (already wired: waiver → capacity-unified)
`req-tx-kinship-home-assessment`, `req-tx-kinship-minstandards-waiver`

Texas's own citations gave a bit more explicit sequencing than California's (the "verification may precede training, but placement may not" language, the major-life-change update trigger) — those are already captured. The remaining open call: does Phase 1 need to fully complete before Phase 2, or do they run together during the same site visit? The source doesn't say.

## Federal (5 requirements — already fully chained)
`req-federal-documentation-submission` → `req-federal-home-study-60-days` → `req-federal-icpc-100a-final-decision-180-days`, plus the parallel/alternate `req-federal-icpc-100b-already-placed-notice`, plus context-only `req-federal-applicability-definitions` (not a checkable requirement, see the file itself).
