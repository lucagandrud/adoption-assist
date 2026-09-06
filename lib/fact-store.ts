/**
 * The case fact store, read side.
 *
 * Two sources today, one object shape:
 *
 *   interview  accepted interview facts (and ONLY accepted ones — a draft
 *              never leaves the review page). provenance.source = "interview".
 *
 *   document   a seeded fixture standing in for extraction output, because
 *              extraction/pipeline.ts is not built. provenance.source =
 *              "document", tagged `fixture: true` so nothing can present it
 *              as extracted.
 *
 * Interview facts and document facts are the same object downstream
 * (CLAUDE.md §4a); only provenance differs. Server-only.
 */

import seed from "@/demo/cases/seed-facts.json";
import { listAcceptedFactsForCase } from "@/lib/interview-store";
import type { FactProvenance } from "@/lib/types";

export interface CaseFact {
  fact_id: string;
  value: string;
  provenance: FactProvenance;
  /** True when the fact comes from a demo fixture rather than a real source. */
  fixture: boolean;
  /** Interview facts only: who said it, for labelling the defect. */
  subject_name?: string;
}

/** Accepted interview facts for a case, with interview provenance attached. */
export async function readAcceptedInterviewFacts(
  userId: string,
  caseId: string,
): Promise<CaseFact[]> {
  const accepted = await listAcceptedFactsForCase(userId, caseId);
  return accepted.map((f) => ({
    fact_id: f.fact_id,
    value: f.value,
    fixture: false,
    subject_name: f.subject_name,
    provenance: {
      source: "interview",
      session_id: f.session_id,
      block_id: f.block_id,
      turn_index: f.turn_index,
      verbatim: f.verbatim,
    },
  }));
}

/** Seeded document-side facts. Fixture until the extraction pipeline exists. */
export function readSeededDocumentFacts(): CaseFact[] {
  const facts = seed.facts as Array<{
    fact_id: string;
    value: string;
    provenance: FactProvenance;
  }>;
  return facts.map((f) => ({ ...f, fixture: true }));
}

export async function readCaseFacts(userId: string, caseId: string): Promise<CaseFact[]> {
  const interview = await readAcceptedInterviewFacts(userId, caseId);
  return [...readSeededDocumentFacts(), ...interview];
}
