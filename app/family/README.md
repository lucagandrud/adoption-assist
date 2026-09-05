# /app/family — the family portal

The primary UI. Deliverables **D3** (dependency graph) and **D6** (voice/chat intake).

## What lives here

- **The dependency graph** — React Flow canvas, auto-laid-out with dagre or elkjs. Node
  states (`locked`, `available`, `in_progress`, `complete`, `defect`), the requirement panel,
  the **Automate** action, critical-path highlighting.
- **Document upload** — feeds [`/extraction`](../../extraction).
- **The 180-day timeline** — Engine 2's validity report, rendered as a horizontal clock.
  Visually central, not tucked in a tab.
- **Voice/chat intake** — browser `SpeechRecognition` (STT) and `SpeechSynthesis` (TTS).

## The text fallback ships unconditionally

> Browser speech APIs fail unpredictably on conference wifi, and a failed voice demo on
> stage is a catastrophic loss.

Text chat is not a stretch goal. Both paths populate the same fields, and every field
produced by intake is tagged with provenance `interview` and flagged for human review in the
caseworker view.

If D6 gets cut (it is cut #1), the text path is what survives.

## Tone

This interface is used by a family trying to take in a child, often under time pressure, with
no right of appeal if the packet is rejected.

- A defect is a question, not an accusation — *"these two documents show different addresses,
  did you move?"* rather than *"error: address mismatch."*
- The projected submission date is the most valuable thing on the screen. Keep it visible.
- Never imply the system is judging the family. It checks paperwork. (Hard boundary #1.)
