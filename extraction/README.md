# /extraction

Document → typed facts, with provenance. Deliverable **D5**, phase hours 2–6.

```
pipeline.ts   the extraction pipeline
prompts/      one extraction prompt per document type
```

This is one of only two places an LLM touches the data path (the other is the voice/chat
interview). Everything downstream of it is deterministic.

## The contract

**In:** an uploaded file plus a declared document type.
**Out:** `Fact[]` where every fact carries provenance — document, page, field — and a
confidence score.

**If a fact cannot be traced to a page and a field, it does not ship.** Engine 1 needs that
provenance to name both sources in a contradiction, and the citation trail is the entire
credibility claim. (CLAUDE.md principle #2.)

## Why extraction is the highest-consequence AI call

A hallucinated value here propagates into a defect report that tells a family their real
paperwork is wrong. That is the worst output this system can produce — it manufactures
exactly the burden the project exists to remove.

Design accordingly:
- Instruct the model to return `null` rather than guess on absent or illegible fields
- Validate every response through Zod; drop facts whose type isn't in `Document.yields_facts`
- Low-confidence facts must not silently drive a **blocking** defect

## Synthetic data only

Hard boundary #3. Every document this pipeline sees — in development, in testing, on stage —
is synthetic. Never upload a real person's records, not once, not to check something. See
[`/demo/families`](../demo/families).

## Demo reliability

⚠️ This path depends on conference wifi and a live API. Both fail on stage.

Before hour 24, cache extraction results for all three synthetic families behind a flag that
serves them instead of calling the API, and **rehearse with the flag on.** A live extraction
that hangs during judging costs more than the credit earned for doing it live.
