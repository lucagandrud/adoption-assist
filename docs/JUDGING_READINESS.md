# DNHacks judging-readiness audit

This audit maps the current build to the attached DNHacks 2026 rubric. It is an evidence map,
not a predicted score.

## Main prizes

### Problem and real-world impact - 25 points

**Evidence:** a specific user, administrative bottleneck, bounded CA/TX relative-placement
workflow, and measurable pilot outcomes. The app catches mismatches and validity risks before
submission rather than replacing the existing interstate exchange system.

**Pitch proof:** open one placement packet, run preflight, show one address contradiction and
one expiry risk, then clear the contradiction with a corrected record.

**Remaining risk:** impact statistics and encoded policy still require human source review.
Do not convert the prototype into a claim of achieved time savings or legal compliance.

### Technical execution - 50 points

**Evidence:** authenticated Supabase persistence, structured ontology, direction-aware graph
composition, schema-constrained PDF extraction, typed facts with provenance, deterministic
consistency and validity engines, failure-safe provider preprocessing, and a repeatable evaluation
harness. The graph is derived from dependencies rather than drawn for the demo.

**Pitch proof:** show live model name and elapsed time, inspect page/field evidence, briefly open
the workflow map, and explain that the same facts drive several deterministic checks.

### Feasibility and deployment potential - 25 points

**Evidence:** one web deployment, one database, server-only model credential, bounded file size,
no raw-file persistence, explicit replay, visible research status, and a narrow pilot proposal.

**Remaining risk:** production requires policy-owner review, formal access controls, audit/event
retention, agency security review, model/data-processing approval, and validation beyond four
synthetic documents.

## Best use of AI

### Novelty and importance - 25 points

AI is necessary for the narrow unstructured-to-structured boundary: heterogeneous PDFs and
scans must become comparable typed facts. Removing AI leaves manual transcription; putting AI
in the rule engine would make the system less trustworthy. This division is the product insight.

### Technical sophistication - 50 points

- Actual PDF bytes sent as document content for live runs.
- Per-document JSON Schema restricts allowed fact types and output shape.
- System instruction treats document text as untrusted data and rejects embedded instructions.
- Local Zod validation, MIME/signature validation, timeout, one transient retry, and duplicate filtering.
- Model, latency, token usage, confidence, page, and field telemetry.
- Golden-set evaluation plus a mocked provider-contract test.
- Deterministic downstream rules and state composition.

### Reliability, evaluation, and trustworthiness - 25 points

The replay and live paths are labeled separately. A live failure leaves prior evidence intact
and offers replay; it never silently reports cached output as AI. Low confidence is reviewable.
The test corpus proves pipeline behavior, not production accuracy. Prompt injection, malformed
files, provider errors, model changes, and missing credentials are explicit failure modes.

## Best in design

### Design quality and craft - 30 points

The product uses a restrained public-service palette, readable type hierarchy, consistent
status treatments, provenance cards, responsive grids, and focus-visible controls. It avoids
decorative AI imagery inside the working interface.

### User experience and usability - 40 points

The main path is now: select case → analyze packet → review unique exceptions → inspect both
sources → replace evidence → confirm the exception clears. The complete graph is available but
does not obstruct the common task. Caseload status is derived from actual documents rather than
decorative seed percentages.

### Understanding of the user - 30 points

`docs/USER_PERSONA.md` identifies the user, jobs, constraints, design consequences, and the
questions still needing practitioner validation. The presentation must call the persona
provisional rather than claiming interviews that did not happen.

## Submission gate

- [ ] Hosted build has `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-5`, and `EXTRACTION_USE_CACHE=0`.
- [ ] Live extraction passes on all fact-bearing golden documents from the deployed URL.
- [ ] Replay is rehearsed as the network/provider fallback.
- [ ] Both presenters complete two timed 2:30 rehearsals.
- [ ] Every statistic spoken on stage has passed `docs/SOURCE_REVIEW_CHECKLIST.md`.
- [ ] A clean screen recording and a local build are available.
