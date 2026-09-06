# Demo and pitch guide

This is the operating README for the presentation: what was built, how to run it, how to
divide the pitch, and how to frame the story without overstating the prototype.

## The winning frame

**One sentence:** ICPC Preflight catches administrative document defects before an interstate
foster-care placement packet is submitted, so caseworkers spend less time restarting work and
children face fewer avoidable delays.

Lead with the bottleneck, not the ontology. Existing exchange systems move packets between
offices; this product checks whether a packet is administratively ready before it enters that
pipe. The buyer is a public child-welfare agency. The daily user is a sending or receiving
caseworker/reviewer. Pilot outcomes are first-pass acceptance, reviewer exception count,
minutes per preflight, rework cycles, and days from packet start to submission.

## What was implemented

- A task-centered overview that puts unique exceptions, expiry risk, phase progress, and next actions before the expert dependency map.
- Clear separation of uploaded files, completed requirements, and unique issues.
- Evidence cards with values, page/field provenance, confidence, and honest Live-AI-versus-replay labels.
- An ontology-derived CA↔TX workflow, deterministic consistency rules, validity calculations, state-pair differences, critical path, and full graph view.
- Four polished synthetic PDFs plus a machine-readable extraction answer key.
- A repeatable extraction/rules evaluation command and explicit limits on its score.
- Visible research/projection caveats and a human source-review process.
- Supabase-backed auth/cases/documents when configured, with a local development fallback.

## 2 minute 30 second demo script

### 0:00–0:25 — Human problem

**Speaker A:** “When a child may be placed with family across state lines, the packet crosses
two bureaucracies. A mismatched address or expiring clearance can send it back for rework.
Current systems transport documents; they do not preflight the evidence.”

Do not open with national statistics unless the source has been checked. A concrete caseworker
task is more credible than an unsupported large-number claim.

### 0:25–0:45 — Product and user

Show the case list, open the demo case, and identify sending and receiving states. Say: “This
is a caseworker tool for administrative readiness—not a family portal and not a placement
decision system.”

### 0:45–1:25 — Central product moment

Click **Start guided demo**. Pause on **Needs attention**. Explain that one inconsistency is
deduplicated even when it affects several requirements. Open it and show both source values,
page, and field. Point out the expiration risk and that extraction is labeled **Verified
replay**, never passed off as a live model call.

Click **Use corrected demo document** and show that the address exception clears while the
expiration warning remains. This is the complete detect → inspect → correct → recheck loop.

Say: “AI reads bounded fields. Versioned rules compare them. The caseworker decides what to correct.”

### 1:25–1:50 — Technical depth

Open **Full workflow map** briefly. Say: “The graph is derived from requirement dependencies,
not hand-drawn. Reversing direction composes a different workflow. Canonical facts feed
consistency, validity, and readiness checks.” Return to overview quickly; do not pan through
65 nodes.

### 1:50–2:10 — Reliability and ethics

Show evidence/provenance and the trust architecture. Say: “The model can only return fields
allowed for that document. Schema validation rejects malformed output. Low confidence
requires review. The system never ranks families or determines suitability.”

### 2:10–2:30 — Feasibility and close

“This fits upstream of NEICE rather than replacing it. A pilot can start with one sending
office, one receiving partner, and the highest-volume packet type. We would measure first-pass
acceptance, exception volume, reviewer time, and days to submission.” End on: **Catch the
paperwork problem before it becomes a child’s delay.**

## Judging-criteria strategy

| Prize / rubric | What to demonstrate | Evidence in the app |
|---|---|---|
| Health & Public Service — problem/impact | Specific frontline user and preventable public-service delay | Issue-first flow and narrow pilot metrics |
| Main — technical execution | Working end-to-end system | Supabase persistence, extraction contract, rules, derived graph |
| Main — feasibility | Bounded deployment and honest constraints | Two states, synthetic data, production gates |
| Best AI — fundamental use | PDFs must become comparable facts | Typed extraction with provenance |
| Best AI — sophistication | Hybrid, validated architecture | Constraints, retries, confidence, deterministic rules |
| Best AI — reliability/trust | Reproducibility and humans in control | Replay label, golden set, no suitability decision |
| Best Design — craft | Clear hierarchy and consistency | Restrained overview and evidence cards |
| Best Design — UX | Fast path from issue to evidence | Unique exceptions, next actions, expert map secondary |
| Best Design — user understanding | Language matches casework | Phase model and accurate count labels |

## Presenter roles

**Speaker A — problem and close:** owns the first 45 seconds and final 20 seconds. Keep the
human consequence and pilot model clear.

**Speaker B — product and technical proof:** drives the app from 0:45–2:10. Practice the exact
click path and stop explaining internals once the rubric point is established.

## Demo setup checklist

1. Use Chrome or Safari at 1440×900 or larger and 100% zoom.
2. Confirm `/api/session` reports `"backend":"supabase"` on the deployed app.
3. Confirm the demo user can open the case and click **Start guided demo**.
4. Run `npm run verify:ontology`, `npm run evaluate:extraction`, `npm run lint`, and `npm run build` on the submission commit.
5. Open every PDF once and confirm its synthetic watermark is visible.
6. Reset the packet and rehearse the exact click path twice with a timer.
7. Record a clean screen capture; keep one local build running as fallback.
8. Silence notifications, hide bookmarks, close unrelated tabs, and connect power.

## Failure plan

- **Network or host fails:** switch to the local build.
- **AI provider fails:** use the clearly labeled deterministic replay and show the evaluation harness.
- **Supabase session expires:** sign in before judging; keep the local fallback preloaded.
- **Graph is dense:** return to Case overview. The map proves derivation; it is not the primary task surface.
- **A judge asks whether requirements are legally validated:** answer no; show the visible review status and checklist.

## Likely questions

**Is this just a checklist?** No. Applicability and dependencies are composed from structured
requirements; facts support cross-document consistency and validity checks.

**Why use AI?** Exact fields must be recovered from heterogeneous PDFs and scans. Rules are a
poor tool for document reading; an LLM is a poor tool for legal decisions. Each is used only
where appropriate.

**How do you know the AI is right?** We do not assume it is. Output is constrained and
validated, carries provenance/confidence, can be reviewed, and is measured against a golden
set. The current set proves the pipeline, not production accuracy.

**What about privacy?** The demo uses synthetic records. A pilot requires agency security
review, minimum-necessary access, retention controls, audit logs, and an approved processing arrangement.

**Does it approve placements?** No. Licensed staff and state authorities make all substantive decisions.

**How does it scale?** State content lives in versioned ontology data; the engines are
jurisdiction-agnostic. Expansion still requires policy-owner review—it is data work, not zero work.

## Submission language

Use **ICPC Preflight** in the pitch even though the repository retains its engineering name.
Suggested subtitle: “Administrative readiness for interstate foster-care placement packets.”
Avoid claiming guaranteed compliance, achieved time savings, production readiness, broad
regulatory validation, or meaningful AI accuracy from four examples.
