/**
 * Shared shapes for the two interview storage backends.
 * See lib/interview-store.ts for the facade.
 */

import type { InterviewFact } from "@/lib/types";

export interface CreateSessionInput {
  subject_name: string;
  subject_role: string;
  script_id: string;
}

/**
 * Result of a token-scoped write. `invalid` covers unknown and expired
 * tokens alike — the subject's page shows one message for both, and telling
 * them apart would let a caller probe which tokens exist.
 */
export type TokenResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid" | "closed" };

/** An accepted fact with enough of its session to name the source. */
export interface AcceptedCaseFact extends InterviewFact {
  subject_name: string;
  subject_role: string;
}
