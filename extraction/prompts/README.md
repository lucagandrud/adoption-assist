# /extraction/prompts

One extraction prompt per document type, as Markdown files named after the type:

```
tax-return.md
government-id.md
marriage-certificate.md
fingerprint-clearance.md
medical-exam.md
...
```

## Prompt requirements

Every prompt must instruct the model to:

1. **Return the page number and the printed field label** for every value extracted. This is
   provenance, and a fact without it is dropped by the pipeline.
2. **Return `null` rather than guess** when a field is absent, illegible, or ambiguous.
3. **Emit only the fact types this document yields** — read the list from
   `Document.yields_facts` in the ontology rather than restating it in the prompt text, so
   the two cannot drift apart.
4. **Report a confidence per field**, not one score for the document.

## What prompts must not do

- **No assessment.** A prompt never asks the model whether a home is suitable, whether income
  is adequate, or whether anything is concerning. Extraction reads what the document says.
  Judgment is the licensed social worker's. (Hard boundary #1.)
- **No inference across documents.** Cross-document reasoning is Engine 1's job, and it is
  deterministic. A prompt that sees two documents and opines on whether they agree has moved
  an LLM into the decision path.

## Synthetic documents only

Test against `/demo/families`. Never a real record. (Hard boundary #3.)

## Status

❌ Empty. Prompts get written alongside the pipeline in hours 2–6.
