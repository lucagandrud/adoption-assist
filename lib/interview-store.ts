/**
 * Interview persistence facade — same shape as lib/store.ts.
 *
 * Supabase when configured, the local JSON file otherwise. No route handler
 * or page imports a backend directly, so the interview room works on a
 * fresh clone with no credentials and on the shared database in production.
 *
 * Two halves:
 *   caseworker  — userId-scoped, ownership checked via the parent case
 *   by token    — no user; the link token is the capability
 *
 * Server-only. Never import from a client component.
 */

import { isSupabaseConfigured } from "@/lib/supabase";
import * as json from "@/lib/interview-store-json";
import * as supa from "@/lib/interview-store-supabase";
import type {
  InterviewFact,
  InterviewSession,
  InterviewSessionPublic,
  InterviewTurn,
} from "@/lib/types";
import type {
  AcceptedCaseFact,
  CreateSessionInput,
  TokenResult,
} from "@/lib/interview-store-types";

export type { AcceptedCaseFact, CreateSessionInput, TokenResult };

const backend = () => (isSupabaseConfigured() ? supa : json);

/* ------------------------------ caseworker -------------------------------- */

export function listSessions(userId: string, caseId: string): Promise<InterviewSession[]> {
  return backend().listSessions(userId, caseId);
}

export function createSession(
  userId: string,
  caseId: string,
  input: CreateSessionInput,
): Promise<InterviewSession | null> {
  return backend().createSession(userId, caseId, input);
}

export function findSession(
  userId: string,
  caseId: string,
  sessionId: string,
): Promise<InterviewSession | null> {
  return backend().findSession(userId, caseId, sessionId);
}

export function listTurns(userId: string, sessionId: string): Promise<InterviewTurn[]> {
  return backend().listTurns(userId, sessionId);
}

export function listFacts(userId: string, sessionId: string): Promise<InterviewFact[]> {
  return backend().listFacts(userId, sessionId);
}

/** The only write path that flips `accepted`. Caseworker-only by construction. */
export function acceptFact(
  userId: string,
  sessionId: string,
  factId: string,
  value?: string,
): Promise<InterviewFact | null> {
  return backend().acceptFact(userId, sessionId, factId, value);
}

export function revokeFact(
  userId: string,
  sessionId: string,
  factId: string,
): Promise<InterviewFact | null> {
  return backend().revokeFact(userId, sessionId, factId);
}

export function markReviewed(userId: string, sessionId: string): Promise<boolean> {
  return backend().markReviewed(userId, sessionId);
}

export function listAcceptedFactsForCase(
  userId: string,
  caseId: string,
): Promise<AcceptedCaseFact[]> {
  return backend().listAcceptedFactsForCase(userId, caseId);
}

export function insertTranscript(
  userId: string,
  sessionId: string,
  turns: InterviewTurn[],
  facts: Omit<InterviewFact, "id" | "session_id" | "accepted" | "accepted_at" | "accepted_by">[],
  status: InterviewSession["status"],
): Promise<boolean> {
  return backend().insertTranscript(userId, sessionId, turns, facts, status);
}

/* -------------------------------- by token -------------------------------- */

export function getSessionByToken(token: string): Promise<InterviewSessionPublic | null> {
  return backend().getSessionByToken(token);
}

export function getTurnsByToken(token: string): Promise<InterviewTurn[]> {
  return backend().getTurnsByToken(token);
}

export function appendTurnByToken(token: string, turn: InterviewTurn): Promise<TokenResult<null>> {
  return backend().appendTurnByToken(token, turn);
}

export function recordFactByToken(
  token: string,
  fact: { fact_id: string; value: string; verbatim: string; block_id: string; turn_index: number },
): Promise<TokenResult<null>> {
  return backend().recordFactByToken(token, fact);
}

export function completeByToken(token: string): Promise<TokenResult<null>> {
  return backend().completeByToken(token);
}
