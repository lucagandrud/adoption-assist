/* =============================================================================
 * PSEUDOCODE — NOT IMPLEMENTED
 * =============================================================================
 * Nothing in this file executes. There are no imports, no exports, and no
 * runnable statements — only a commented design sketch.
 *
 * File:    extraction/pipeline.ts
 * Purpose: document → typed facts, with provenance. Feeds every engine.
 * Owner:   unassigned
 * Phase:   Hours 2–6
 *
 * This is the ONLY place in the system where an LLM touches the data path,
 * alongside the interview. Everything downstream is deterministic.
 * (CLAUDE.md principle #3.)
 * ============================================================================= */

// ---------------------------------------------------------------------------
// CONTRACT
// ---------------------------------------------------------------------------
// In:  an uploaded file + a declared document type
// Out: Fact[] where EVERY fact carries provenance (document, page, field)
//      and a confidence score
//
// If a fact cannot be traced to a page and a field, it does not ship. The
// provenance is not decoration — Engine 1 needs it to name both sources in a
// contradiction, and the citation trail is the credibility claim.
// (CLAUDE.md principle #2.)
//
// ---------------------------------------------------------------------------
// MAIN ENTRY
// ---------------------------------------------------------------------------
//
// function extractDocument(file, declaredType, ontology) -> ExtractionResult
//
//     1. VALIDATE
//        - file type in the accepted set (PDF, PNG, JPG)
//        - size under the cap
//        - declaredType resolves to a Document in the ontology
//
//     2. NORMALIZE TO PAGE IMAGES
//        - PDF → one image per page (page numbers must survive this step;
//          they are provenance, not metadata)
//        - image → single page
//
//     3. SELECT PROMPT
//        prompt = prompts/{declaredType}.md
//        Each prompt names exactly the fact types this document yields —
//        read them from Document.yields_facts rather than duplicating the
//        list in the prompt text, so ontology and prompt cannot drift apart.
//
//     4. CALL CLAUDE WITH VISION
//        - request STRUCTURED output matching the fact schema
//        - require the model to return, for every field: the page number,
//          the field label as printed on the form, and a confidence
//        - instruct it to return null rather than guess when a field is
//          absent or illegible
//
//        ⚠️ A hallucinated value here propagates into a defect report that
//        tells a family their real paperwork is wrong. Extraction is the
//        highest-consequence AI call in the system. Prefer nulls.
//
//     5. VALIDATE THE RESPONSE
//        - parse through Zod
//        - drop any fact whose type is not in Document.yields_facts
//          (the model inventing extra facts is a real failure mode)
//        - drop any fact missing page/field provenance
//        - on parse failure: retry ONCE, then fail the upload with a clear
//          message. Never emit partial facts from a malformed response.
//
//     6. ATTACH PROVENANCE
//        every fact gets:
//          { source_kind: "document", document_id, page, field, extracted_at }
//
//     7. RETURN — do NOT write to the fact store here
//        Persistence is the caller's job (the Automate action). Keeping this
//        function pure makes it testable without a database, which matters at
//        hour 3 when Supabase is half-configured.
//
// ---------------------------------------------------------------------------
// CONFIDENCE HANDLING
// ---------------------------------------------------------------------------
// Low-confidence facts must NOT silently drive a blocking defect. A defect
// message that says "your documents contradict each other" when the real
// problem is that the OCR misread a smudged ZIP code is the worst output this
// system can produce.
//
// Proposal: a confidence floor from the ontology. Below it, the fact is
// retained but marked `needs_review` and any defect it triggers is downgraded
// to a warning that says the source was hard to read.
//
// ---------------------------------------------------------------------------
// INTERVIEW-SOURCED FACTS
// ---------------------------------------------------------------------------
// Facts from voice/chat intake enter through the same Fact shape but with
// provenance source_kind "interview" and no page/field. They are ALWAYS
// flagged for human review in the caseworker view. (CLAUDE.md §6.6.)
//
// ---------------------------------------------------------------------------
// SYNTHETIC DATA ONLY
// ---------------------------------------------------------------------------
// Hard boundary #3. Every document this pipeline sees during development and
// demo is synthetic. Never upload a real person's records — not to test, not
// once. See /demo/families.
//
// ---------------------------------------------------------------------------
// DEMO RELIABILITY
// ---------------------------------------------------------------------------
// ⚠️ This path depends on conference wifi and a live API. Both fail on stage.
//
// Before hour 24, cache the extraction results for all three synthetic
// families and add a flag that serves the cached facts instead of calling the
// API. Rehearse with the flag ON. A live extraction that hangs during
// judging costs more than the credit for doing it live.
