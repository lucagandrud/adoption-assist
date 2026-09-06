# Synthetic demo documents

These four PDFs form the repeatable Rivera case demonstration. Every page is visibly
watermarked **SYNTHETIC DEMO — NOT A REAL CASE RECORD**. They contain fabricated names,
addresses, identifiers, and dates and must never be presented as agency records.

| File | Role in the demonstration |
|---|---|
| `rfa-application-rivera.pdf` | Establishes the applicant name and residence address. |
| `home-safety-assessment-conflict.pdf` | Contains a different residence address and triggers the deterministic consistency rule. |
| `home-safety-assessment-corrected.pdf` | Replaces the conflicting address and demonstrates resolution. |
| `health-screening-rivera.pdf` | Demonstrates expiration risk against the projected decision date. |

`../fixtures/extraction/expected.json` is the human-authored answer key used by
`npm run evaluate:extraction`. Regenerate the PDFs with
`python3 scripts/generate-demo-documents.py`; then inspect every rendered page before using
them. Cached extraction is a deterministic replay, not an AI call, and the interface labels
it accordingly.

