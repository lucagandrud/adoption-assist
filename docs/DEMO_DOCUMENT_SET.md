# Demo document set and process map

## Purpose

The prototype is not a generic upload portal. It is a **pre-submission document preflight**
for an interstate foster-care placement packet. It reads administrative fields, maps them to
canonical facts, and runs versioned rules before the packet enters the existing ICPC exchange
process. A human caseworker remains responsible for all substantive judgments.

## Golden demo packet

The four files in `demo/documents/` are the only files required for the stage demo. Together
they demonstrate the complete product loop: evidence arrives, facts are extracted with
provenance, a cross-document inconsistency is surfaced, an expiration risk is calculated,
and a corrected document clears the inconsistency.

| Document | Owner / stage | Facts used | Demo purpose |
|---|---|---|---|
| Resource Family Application (RFA-01A) | Receiving state / applicant intake | Legal name, residence address | Baseline fact source |
| Home and Safety Assessment — conflict | Receiving state / home assessment | Residence address | Intentional contradiction |
| Home and Safety Assessment — corrected | Receiving state / exception resolution | Residence address | Corrective replacement |
| Applicant Health Screening | Receiving state / readiness review | Issue date | Expiration-risk example |

The expected extraction values are in `demo/fixtures/extraction/expected.json`. This creates a
small, inspectable evaluation set rather than relying on an unrepeatable stage upload.

## Broader packet model

The composed CA/TX relative-placement workflow contains many more possible requirements. For
the narrative, describe these as five operational phases:

1. **Authorization and intake:** court/conservatorship authority, placement request, and case identifiers.
2. **Packet preparation:** ICPC-100A, case history, financial/medical plan, and receiving-state application materials.
3. **Background checks:** criminal history, child-abuse registries, and jurisdiction-specific clearances.
4. **Home assessment:** household composition, interviews, physical environment, safety, health, income, and training evidence.
5. **Filing and decision:** supervisory review, interstate-office transmission, home-study response, and placement decision.

The ontology currently models 81 document definitions. That is coverage infrastructure, not
a claim that every case needs 81 uploads. Applicability, dependencies, direction, and case
profile determine the active workflow.

## Responsibility and claims boundary

| Evidence source | Typical responsibility | Product treatment |
|---|---|---|
| Sending-state case file | Sending caseworker | Completeness and cross-document consistency |
| Prospective caregiver forms | Existing receiving-state process | Administrative field extraction only |
| Background-clearance result | Authorized agency | Presence, identity linkage, and validity; never infer suitability |
| Home-study report | Licensed practitioner / receiving agency | Presence and administrative facts; never score the home |
| Court order | Court / sending agency | Presence and dates; no model-based legal interpretation |

- A green state means required evidence is present and internally consistent—not that a
  family is suitable or a placement is approved.
- All files are synthetic. No real child or family data is included.
- All research-backed requirement/document entries remain `verified: false` until a human
  checks the cited source.

