# Human source-review checklist

## Current status

All ontology requirements and document definitions intentionally remain `verified: false`.
AI-assisted research assembled citations, but no human has completed the legal/policy review.
This is the correct state for a hackathon prototype. Do not bulk-change these flags.

## Minimum pre-pitch review

- [ ] ICPC Regulation 2: packet documentation and receiving-state home-study timing.
- [ ] California RFA Written Directives: RFA-01A, home/environment assessment, health screening, and validity language.
- [ ] Texas DFPS ICPC Resource Guide: packet components and conservatorship threshold.
- [ ] Texas DFPS CPS Handbook Chapter 4500: regular/expedited routing.
- [ ] Every statistic quoted in the pitch, using `docs/SOURCES.md` as the ledger.

For each entry, open the linked primary source, confirm the page/section and effective date,
and check jurisdiction, case type, direction, conditions, and timing unit. Record reviewer,
date, source version, and corrections. Only then change that individual entry to
`verified: true` and run `npm run verify:ontology`.

## Stage-safe language

Say: “We encoded an illustrative CA/TX workflow from cited public materials, and the product
surfaces research that has not received human review.”

Do not say: “The system guarantees legal compliance,” “these are all documents required in
every case,” or “the AI interprets the law.”

## Production gate

Production use requires agency counsel/policy-owner review, change monitoring, effective-date
versioning, role-based access, audit retention, threat modeling, and validation on approved
de-identified records. The prototype does not claim those controls are complete.

