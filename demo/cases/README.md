# /demo/cases — synthetic example case

Deliverable **D2**. One example case with fabricated documents, driving all three demo beats.

> ## ⚠️ EVERYTHING HERE IS FICTIONAL
>
> Hard boundary #3: **no real records, ever.** Names, addresses, SSNs, employers, and dates
> are fabricated. Never place a real person's documents in this directory — not to test, not
> once, not temporarily.
>
> Use obviously-synthetic values: `555` phone numbers, `example.com` emails, addresses that
> do not resolve.

## The three beats

### 1. Workflow derivation
Select the case with **CA → TX**. The branching workflow composes from regulation data with
citations on the nodes. Flip to **TX → CA** and show it change.

Requires enough CA and TX ontology data that the two directions genuinely differ. If they
render the same graph, this beat fails — and that is an ontology problem, not a UI problem.

### 2. Clean verification
Upload a document that passes. Node turns green. The panel shows the rule that ran and the
page/field each value came from.

### 3. The defect — the money shot
**Address on the tax return contradicts the home study address.**

The system names both source documents, the page and field, and the rule violated. This is
the single most important moment in the demo. *Make it unmissable.*

Build this one first and use it as the running test case for F2. Discovering at hour 21 that
your money shot doesn't work is not a risk worth taking.

## What the case needs

- Synthetic source documents (PDF/image) for the extraction pipeline
- A state pair and direction
- A family profile (relationship, children, placement type) so `applies_to` filtering resolves
- Expected output, so you can tell whether a change broke a beat

## Anchor the dates

Set issue dates relative to a **fixed anchor date**, not `today()`. A clearance that expires
"in 40 days" when you build it on Saturday has expired by the time you demo on Sunday if the
arithmetic floats.

## Cache the extraction results

Before hour 24, cache extraction output behind a flag that serves the cache instead of calling
the Anthropic API, and **rehearse with the flag on.** Conference wifi fails. A live extraction
that hangs during judging costs more than the credit for doing it live.

## Status

❌ Not built. Phase hours 21–23 — but **build the defect case early**, as the test fixture
for F2.
