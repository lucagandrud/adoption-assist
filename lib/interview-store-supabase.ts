/**
 * Supabase backend for interview sessions, turns, and facts.
 *
 * Two clients, on purpose:
 *
 *   Caseworker side   the cookie-bound server client. RLS through the parent
 *                     case's owner_user_id is the security boundary; the
 *                     `.eq()` filters are belt-and-braces.
 *
 *   Token side        a bare anon client with no cookies. The subject has no
 *                     account, so every call goes through the SECURITY
 *                     DEFINER functions in 0002_interviews.sql, each scoped
 *                     to the one session whose link_token matches. The anon
 *                     role has no direct table access at all.
 *
 * Server-only.
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseServerClient } from "@/lib/supabase";
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

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase is not configured.");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

interface SessionRow {
  id: string;
  case_id: string;
  subject_name: string;
  subject_role: string;
  script_id: string;
  status: InterviewSession["status"];
  link_token: string;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

function toSession(row: SessionRow): InterviewSession {
  return { ...row };
}

/** Postgres errcodes raised by the token functions in the migration. */
function tokenFailure(error: { code?: string } | null): TokenResult<never> {
  if (error?.code === "P0003") return { ok: false, reason: "closed" };
  return { ok: false, reason: "invalid" };
}

/* ------------------------------ caseworker -------------------------------- */

export async function listSessions(
  userId: string,
  caseId: string,
): Promise<InterviewSession[]> {
  void userId; // RLS scopes the query; the case id is enough here.
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as SessionRow[]).map(toSession);
}

export async function createSession(
  userId: string,
  caseId: string,
  input: CreateSessionInput,
): Promise<InterviewSession | null> {
  void userId;
  const supabase = await supabaseServerClient();
  // link_token and expires_at (7 days) are minted by column defaults; the
  // insert policy refuses a case the caseworker does not own.
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({ case_id: caseId, ...input })
    .select()
    .single();
  if (error || !data) return null;
  return toSession(data as SessionRow);
}

export async function findSession(
  userId: string,
  caseId: string,
  sessionId: string,
): Promise<InterviewSession | null> {
  void userId;
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("case_id", caseId)
    .maybeSingle();
  return data ? toSession(data as SessionRow) : null;
}

export async function listTurns(
  userId: string,
  sessionId: string,
): Promise<InterviewTurn[]> {
  void userId;
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("interview_turns")
    .select("turn_index, speaker, text, started_at, ended_at")
    .eq("session_id", sessionId)
    .order("turn_index");
  return (data ?? []) as InterviewTurn[];
}

export async function listFacts(
  userId: string,
  sessionId: string,
): Promise<InterviewFact[]> {
  void userId;
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("interview_facts")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_index");
  return (data ?? []) as InterviewFact[];
}

export async function acceptFact(
  userId: string,
  sessionId: string,
  factId: string,
  value?: string,
): Promise<InterviewFact | null> {
  const supabase = await supabaseServerClient();
  const patch: Record<string, unknown> = {
    accepted: true,
    accepted_at: new Date().toISOString(),
    accepted_by: userId,
  };
  if (value !== undefined) patch.value = value;
  const { data } = await supabase
    .from("interview_facts")
    .update(patch)
    .eq("id", factId)
    .eq("session_id", sessionId)
    .select()
    .maybeSingle();
  return (data as InterviewFact | null) ?? null;
}

export async function revokeFact(
  userId: string,
  sessionId: string,
  factId: string,
): Promise<InterviewFact | null> {
  void userId;
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("interview_facts")
    .update({ accepted: false, accepted_at: null, accepted_by: null })
    .eq("id", factId)
    .eq("session_id", sessionId)
    .select()
    .maybeSingle();
  return (data as InterviewFact | null) ?? null;
}

export async function markReviewed(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  void userId;
  const supabase = await supabaseServerClient();
  const { error, count } = await supabase
    .from("interview_sessions")
    .update({ status: "reviewed" }, { count: "exact" })
    .eq("id", sessionId);
  return !error && (count ?? 0) > 0;
}

export async function listAcceptedFactsForCase(
  userId: string,
  caseId: string,
): Promise<AcceptedCaseFact[]> {
  const sessions = await listSessions(userId, caseId);
  if (sessions.length === 0) return [];
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("interview_facts")
    .select("*")
    .in("session_id", [...byId.keys()])
    .eq("accepted", true);
  return ((data ?? []) as InterviewFact[]).map((f) => ({
    ...f,
    subject_name: byId.get(f.session_id)?.subject_name ?? "",
    subject_role: byId.get(f.session_id)?.subject_role ?? "",
  }));
}

export async function insertTranscript(
  userId: string,
  sessionId: string,
  turns: InterviewTurn[],
  facts: Omit<InterviewFact, "id" | "session_id" | "accepted" | "accepted_at" | "accepted_by">[],
  status: InterviewSession["status"],
): Promise<boolean> {
  void userId;
  const supabase = await supabaseServerClient();
  await supabase.from("interview_turns").delete().eq("session_id", sessionId);
  await supabase.from("interview_facts").delete().eq("session_id", sessionId);
  if (turns.length) {
    const { error } = await supabase
      .from("interview_turns")
      .insert(turns.map((t) => ({ ...t, session_id: sessionId })));
    if (error) return false;
  }
  if (facts.length) {
    const { error } = await supabase
      .from("interview_facts")
      .insert(facts.map((f) => ({ ...f, session_id: sessionId })));
    if (error) return false;
  }
  const { error } = await supabase
    .from("interview_sessions")
    .update({
      status,
      completed_at:
        status === "complete" || status === "reviewed"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", sessionId);
  return !error;
}

/* -------------------------------- by token -------------------------------- */

export async function getSessionByToken(
  token: string,
): Promise<InterviewSessionPublic | null> {
  const { data } = await anonClient().rpc("get_interview_by_token", {
    p_token: token,
  });
  const rows = (data ?? []) as InterviewSessionPublic[];
  return rows[0] ?? null;
}

export async function getTurnsByToken(token: string): Promise<InterviewTurn[]> {
  const { data } = await anonClient().rpc("get_interview_turns_by_token", {
    p_token: token,
  });
  return (data ?? []) as InterviewTurn[];
}

export async function appendTurnByToken(
  token: string,
  turn: InterviewTurn,
): Promise<TokenResult<null>> {
  const { error } = await anonClient().rpc("append_interview_turn", {
    p_token: token,
    p_turn_index: turn.turn_index,
    p_speaker: turn.speaker,
    p_text: turn.text,
    p_started_at: turn.started_at,
    p_ended_at: turn.ended_at,
  });
  return error ? tokenFailure(error) : { ok: true, value: null };
}

export async function recordFactByToken(
  token: string,
  fact: { fact_id: string; value: string; verbatim: string; block_id: string; turn_index: number },
): Promise<TokenResult<null>> {
  const { error } = await anonClient().rpc("record_interview_fact", {
    p_token: token,
    p_fact_id: fact.fact_id,
    p_value: fact.value,
    p_verbatim: fact.verbatim,
    p_block_id: fact.block_id,
    p_turn_index: fact.turn_index,
  });
  return error ? tokenFailure(error) : { ok: true, value: null };
}

export async function completeByToken(token: string): Promise<TokenResult<null>> {
  const { error } = await anonClient().rpc("complete_interview_by_token", {
    p_token: token,
  });
  return error ? tokenFailure(error) : { ok: true, value: null };
}
