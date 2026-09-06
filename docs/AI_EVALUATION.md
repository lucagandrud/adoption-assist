# AI extraction evaluation and trust model

## What AI does

The language model has one bounded job: convert a synthetic PDF or image into ontology-approved
facts. Its response is schema-validated; facts outside the selected document contract are
dropped. Every accepted value carries the source document, printed field, page, extraction
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
EXTRACTION_USE_CACHE=0 npm run evaluate:extraction:live
```

Record the raw output, model identifier, prompt version/commit, and execution date. Do not
quote live accuracy until this passes on the exact submission build. Four documents are a
functional smoke test, not statistically meaningful validation.

## Reliability controls

1. MIME type and 10 MB size limits before extraction.
2. Constrained prompt with an explicit allow-list of fact types.
3. Zod validation of structure, confidence, page, and field.
4. Unknown fact types dropped before persistence.
5. One retry for transient live-model failures; errors remain visible.
6. Values below 80% confidence are marked for human review and downgrade blocking defects to warnings.
7. Deterministic rules include both sources and provenance in every defect.
8. Explicit mode labels: **Live AI** or **Verified replay**.

## Limitations and next validation

Before any pilot, expand the corpus across scan quality, handwriting, multi-page forms,
missing fields, OCR confusions, multilingual records, and adversarial text. Measure field-level
precision/recall, confidence calibration, false-negative rates, latency, cost, and reviewer
correction rate. Use only approved synthetic or de-identified documents until security,
retention, access-control, and agency agreements are complete.

