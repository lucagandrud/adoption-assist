# AI extraction evaluation and trust model

## What AI does

The language model has one bounded job: convert a synthetic PDF or image into ontology-approved
facts. The live Claude request uses a document-specific JSON Schema through structured output,
so the model can return only the extracted fact types allowed for that document. Provider-side
constraints use only Anthropic-supported schema keywords; strict object shape, complete field
coverage, value types, ranges, dates, enums, and uniqueness are enforced locally before
persistence. Every accepted value carries the source document, printed field, page, extraction
time, and confidence.

AI does not determine applicability, satisfy requirements, compute deadlines, approve a
family, or predict a case outcome. Those operations use deterministic TypeScript engines and
versioned ontology data.

## Repeatable evaluation

Run the offline acceptance suite:

```bash
npm run evaluate:extraction
```

It evaluates four synthetic PDFs against `demo/fixtures/extraction/expected.json` and fails
unless every expected fact is recovered, no out-of-contract fact appears, provenance is
complete, the conflicting assessment triggers the address rule, and the corrected assessment
clears it. The offline run measures the deterministic replay used for a reliable stage demo.
Its perfect score is **not a claim about model accuracy**.

## Live-model evaluation

With `ANTHROPIC_API_KEY` and a currently supported `ANTHROPIC_MODEL` configured:

```bash
npm run evaluate:extraction:live
```

Record the raw output, model identifier, prompt version/commit, and execution date. Do not
quote live accuracy until this passes on the exact submission build. Four documents are a
functional smoke test, not statistically meaningful validation.

## Reliability controls

1. Authentication plus MIME type and 10 MB size limits before extraction.
2. Document-specific JSON Schema with an explicit enum of allowed extracted fact types.
3. Provider-side constrained decoding followed by strict Zod and ontology-type validation.
4. Missing, null, extra, duplicate, wrongly typed, or invalid-enum values fail closed and are never persisted.
5. Refusals and truncated output fail visibly instead of being parsed as successful analysis.
6. A 45-second request timeout and one retry; errors remain visible and never silently become replay results.
7. Values below 80% confidence are marked for human review and downgrade blocking defects to warnings.
8. Deterministic rules include both sources and provenance in every defect.
9. Explicit mode labels, model name, elapsed time, and token telemetry for live runs.

`claude-sonnet-5` is the default because this task is bounded extraction rather than open-ended
reasoning; it provides a better latency/cost posture than defaulting to the largest model. The
model remains configurable through `ANTHROPIC_MODEL` and must be re-evaluated when changed.

Run the mocked live-contract test without an API key:

```bash
npm run test:live-pipeline
```

This verifies PDF byte encoding, Anthropic-supported structured-output shape, local completeness
rejection, a transient-failure retry, usage telemetry, and provenance. It does not claim that an
external model was contacted.

## Limitations and next validation

Before any pilot, expand the corpus across scan quality, handwriting, multi-page forms,
missing fields, OCR confusions, multilingual records, and adversarial text. Measure field-level
precision/recall, confidence calibration, false-negative rates, latency, cost, and reviewer
correction rate. Use only approved synthetic or de-identified documents until security,
retention, access-control, and agency agreements are complete.
