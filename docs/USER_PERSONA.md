# Guiding user: interstate-placement caseworker

## Status

This is a design persona derived from the workflow and public process materials, not from a
completed practitioner interview. It should guide the hackathon prototype while remaining
explicitly provisional. The next validation step is structured review with sending-state and
receiving-state ICPC staff.

## Primary user

**Jordan, public child-welfare caseworker coordinating an interstate relative placement**

Jordan owns a case in the sending state and must assemble a packet that another state's office
can act on. The evidence comes from multiple people and systems, often as scans. Jordan needs
to know what is missing, what contradicts another record, what may expire before a decision,
and what to correct next. Jordan does not need an AI conversation, a legal-research interface,
or a 65-node graph as the default screen.

## Jobs to be done

1. Identify the active interstate case and confirm direction.
2. See whether the packet has been analyzed and which items need attention.
3. Add or replace the correct type of evidence.
4. Understand an exception without hunting through every file.
5. Confirm the source page and field before correcting the case record.
6. Re-run checks and know whether the exception cleared.
7. Preserve human authority over all legal, safety, and suitability decisions.

## Working constraints

- Frequent interruptions make persistent state and clear resume points important.
- State direction is safety-critical; reversing sending and receiving roles changes the workflow.
- Scans vary in quality, so low-confidence transcription must remain reviewable.
- Caseworkers need plain language first and policy citations on demand.
- Color cannot be the only status signal.
- An external AI or network failure must not erase the prior packet or become a fake success.
- Real records would require agency-approved security and retention controls absent from this prototype.

## Design decisions derived from the persona

| User need | Product decision |
|---|---|
| Resume quickly | Caseload cards derive current status from saved evidence and sort attention first. |
| Know what to do | Case overview leads with sample analysis, exceptions, and next actions. |
| Avoid duplicate noise | One underlying contradiction is deduplicated even if it affects multiple requirements. |
| Trust an exception | Both source values, document names, pages, fields, and confidence remain visible. |
| Avoid accidental role reversal | Sending and receiving states are separately labeled with a literal direction sentence. |
| Survive model failure | Live analysis finishes before replacing prior evidence; replay is a separate explicit action. |
| Preserve professional judgment | The interface says administrative readiness, never approval or family fitness. |
| Inspect complexity only when needed | The full derived workflow map is secondary to the task-centered overview. |

## Interview questions for post-hackathon validation

- Where do returned packets most often fail administrative review?
- Who owns correction of each common exception?
- At what point would preflight fit without duplicating NEICE entry?
- Which dates are entered manually, and which appear reliably on documents?
- What evidence must remain visible for a reviewer to trust an automated flag?
- Which false negative would be most harmful? Which false positive would waste the most time?
- What access, retention, and audit requirements govern an approved pilot?

