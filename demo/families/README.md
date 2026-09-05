# /demo/families — synthetic demo families

Deliverable **D8**. Three families, one per demo beat.

> ## ⚠️ EVERY FAMILY HERE IS FICTIONAL
>
> Hard boundary #3: **no real PII, ever.** Names, addresses, SSNs, employers, and dates are
> all fabricated. Never place a real person's records in this directory — not to test, not
> once, not temporarily.
>
> Use obviously-synthetic values: `555` phone numbers, `example.com` emails, and addresses
> that do not resolve. If a value looks like it could be someone's real data, change it.

## The three families

### 1. `clean/` — the happy path
Family completes intake, the graph unlocks progressively, a submission-ready date is
computed. Demonstrates critical-path ordering and the live-updating projected date.

### 2. `contradiction/` — the money shot
**The address on the tax return does not match the home study address.**

Engine 1 catches it, names both source documents, and cites the rule. This is the single
most important moment in the demo — *make it unmissable.*

Build this family first. It is what proves the project does something a checklist cannot.

### 3. `expiring/` — the 180-day clock
**A fingerprint clearance lapses at day 140 of the 180-day window.**

The timeline shows the lapse; the system surfaces the renewal action and the deadline. Set
issue dates relative to a fixed anchor date so the demo does not drift — a family whose
document expires "in 40 days" becomes a family whose document expired last week if you build
it on Saturday and demo on Sunday with `today()` arithmetic.

## Each family needs

- Synthetic source documents (PDF/image) for the extraction pipeline
- A state pair and direction (CA → TX or TX → CA)
- A family profile (relative, parent, etc.) so `applies_to` filtering resolves
- Expected output, so you can tell whether a change broke a demo beat

## Cache the extraction results

Before hour 24, cache extraction output for all three families behind a flag that serves the
cache instead of calling the Anthropic API, and **rehearse with the flag on.** Conference
wifi fails. A live extraction that hangs during judging costs more than the credit for doing
it live.

## Status

❌ Not built. Phase hours 22–24 — but **build the contradiction family early** and use it as
the running test case for Engine 1. Waiting until hour 22 to discover your money shot doesn't
work is not a risk worth taking.
