/**
 * Local JSON backend for interview sessions, turns, and facts.
 *
 * Mirrors lib/store-json.ts: zero configuration, survives a restart, lives in
 * the gitignored .data/ directory. Ownership is checked in code here; under
 * Supabase (lib/interview-store-supabase.ts) it is enforced by the database.
 *
 * Server-only. Synthetic subjects only (CLAUDE.md hard boundary #3).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { findCase } from "@/lib/store-json";
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

interface StoredSession extends InterviewSession {
  link_token: string;
}

interface StoredTurn extends InterviewTurn {
  session_id: string;
}

interface Database {
  version: 1;
  sessions: StoredSession[];
  turns: StoredTurn[];
  facts: InterviewFact[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "interviews.json");
const EMPTY: Database = { version: 1, sessions: [], turns: [], facts: [] };
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

async function read(): Promise<Database> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      version: 1,
      sessions: parsed.sessions ?? [],
      turns: parsed.turns ?? [],
      facts: parsed.facts ?? [],
    };
  } catch {
    return { ...EMPTY, sessions: [], turns: [], facts: [] };
  }
}

async function write(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
}

const now = () => new Date().toISOString();

/** Same strength as the Postgres default: 32 random bytes, hex-encoded. */
function mintToken(): string {
  return randomBytes(32).toString("hex");
}

function isLive(session: StoredSession): boolean {
  return new Date(session.expires_at).getTime() > Date.now();
}

function toPublic(s: StoredSession): InterviewSessionPublic {
  return {
    id: s.id,
    subject_name: s.subject_name,
    subject_role: s.subject_role,
    script_id: s.script_id,
    status: s.status,
    expires_at: s.expires_at,
    completed_at: s.completed_at,
  };
}

/** Session only if the signed-in caseworker owns its case. */
async function ownedSession(
  db: Database,
  userId: string,
  sessionId: string,
): Promise<StoredSession | null> {
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const owned = await findCase(userId, session.case_id);
  return owned ? session : null;
}

/* ------------------------------ caseworker -------------------------------- */

export async function listSessions(
  userId: string,
  caseId: string,
): Promise<InterviewSession[]> {
  if (!(await findCase(userId, caseId))) return [];
  const db = await read();
  return db.sessions
    .filter((s) => s.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createSession(
  userId: string,
  caseId: string,
  input: CreateSessionInput,
): Promise<InterviewSession | null> {
  if (!(await findCase(userId, caseId))) return null;
  return serialize(async () => {
    const db = await read();
    const session: StoredSession = {
      id: randomUUID(),
      case_id: caseId,
      subject_name: input.subject_name,
      subject_role: input.subject_role,
      script_id: input.script_id,
      status: "pending",
      link_token: mintToken(),
      expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
      created_at: now(),
      completed_at: null,
    };
    db.sessions.push(session);
    await write(db);
    return session;
  });
}

export async function findSession(
  userId: string,
  caseId: string,
  sessionId: string,
): Promise<InterviewSession | null> {
  const db = await read();
  const session = await ownedSession(db, userId, sessionId);
  return session && session.case_id === caseId ? session : null;
}

export async function listTurns(
  userId: string,
  sessionId: string,
): Promise<InterviewTurn[]> {
  const db = await read();
  if (!(await ownedSession(db, userId, sessionId))) return [];
  return db.turns
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.turn_index - b.turn_index)
    .map(({ session_id: _s, ...turn }) => turn);
}

export async function listFacts(
  userId: string,
  sessionId: string,
): Promise<InterviewFact[]> {
  const db = await read();
  if (!(await ownedSession(db, userId, sessionId))) return [];
  return db.facts
    .filter((f) => f.session_id === sessionId)
    .sort((a, b) => a.turn_index - b.turn_index);
}

export async function acceptFact(
  userId: string,
  sessionId: string,
  factId: string,
  value?: string,
): Promise<InterviewFact | null> {
  return serialize(async () => {
    const db = await read();
    if (!(await ownedSession(db, userId, sessionId))) return null;
    const fact = db.facts.find((f) => f.id === factId && f.session_id === sessionId);
    if (!fact) return null;
    if (value !== undefined) fact.value = value;
    fact.accepted = true;
    fact.accepted_at = now();
    fact.accepted_by = userId;
    await write(db);
    return fact;
  });
}

export async function revokeFact(
  userId: string,
  sessionId: string,
  factId: string,
): Promise<InterviewFact | null> {
  return serialize(async () => {
    const db = await read();
    if (!(await ownedSession(db, userId, sessionId))) return null;
    const fact = db.facts.find((f) => f.id === factId && f.session_id === sessionId);
    if (!fact) return null;
    fact.accepted = false;
    fact.accepted_at = null;
    fact.accepted_by = null;
    await write(db);
    return fact;
  });
}

export async function markReviewed(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  return serialize(async () => {
    const db = await read();
    const session = await ownedSession(db, userId, sessionId);
    if (!session) return false;
    session.status = "reviewed";
    await write(db);
    return true;
  });
}

export async function listAcceptedFactsForCase(
  userId: string,
  caseId: string,
): Promise<AcceptedCaseFact[]> {
  const sessions = await listSessions(userId, caseId);
  if (sessions.length === 0) return [];
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const db = await read();
  return db.facts
    .filter((f) => f.accepted && byId.has(f.session_id))
    .map((f) => ({
      ...f,
      subject_name: byId.get(f.session_id)!.subject_name,
      subject_role: byId.get(f.session_id)!.subject_role,
    }));
}

/** Demo seeding: caseworker-side bulk insert of a finished transcript. */
export async function insertTranscript(
  userId: string,
  sessionId: string,
  turns: InterviewTurn[],
  facts: Omit<InterviewFact, "id" | "session_id" | "accepted" | "accepted_at" | "accepted_by">[],
  status: InterviewSession["status"],
): Promise<boolean> {
  return serialize(async () => {
    const db = await read();
    const session = await ownedSession(db, userId, sessionId);
    if (!session) return false;
    db.turns = db.turns.filter((t) => t.session_id !== sessionId);
    db.facts = db.facts.filter((f) => f.session_id !== sessionId);
    for (const turn of turns) db.turns.push({ ...turn, session_id: sessionId });
    for (const fact of facts) {
      db.facts.push({
        ...fact,
        id: randomUUID(),
        session_id: sessionId,
        accepted: false,
        accepted_at: null,
        accepted_by: null,
      });
    }
    session.status = status;
    session.completed_at =
      status === "complete" || status === "reviewed" ? now() : null;
    await write(db);
    return true;
  });
}

/* -------------------------------- by token -------------------------------- */

export async function getSessionByToken(
  token: string,
): Promise<InterviewSessionPublic | null> {
  const db = await read();
  const session = db.sessions.find((s) => s.link_token === token);
  return session && isLive(session) ? toPublic(session) : null;
}

export async function getTurnsByToken(token: string): Promise<InterviewTurn[]> {
  const db = await read();
  const session = db.sessions.find((s) => s.link_token === token);
  if (!session || !isLive(session)) return [];
  return db.turns
    .filter((t) => t.session_id === session.id)
    .sort((a, b) => a.turn_index - b.turn_index)
    .map(({ session_id: _s, ...turn }) => turn);
}

function openSession(db: Database, token: string): TokenResult<StoredSession> {
  const session = db.sessions.find((s) => s.link_token === token);
  if (!session || !isLive(session)) return { ok: false, reason: "invalid" };
  if (session.status !== "pending" && session.status !== "in_progress") {
    return { ok: false, reason: "closed" };
  }
  return { ok: true, value: session };
}

export async function appendTurnByToken(
  token: string,
  turn: InterviewTurn,
): Promise<TokenResult<null>> {
  return serialize(async () => {
    const db = await read();
    const found = openSession(db, token);
    if (!found.ok) return found;
    const session = found.value;
    const existing = db.turns.findIndex(
      (t) => t.session_id === session.id && t.turn_index === turn.turn_index,
    );
    const row: StoredTurn = { ...turn, session_id: session.id };
    if (existing >= 0) db.turns[existing] = row;
    else db.turns.push(row);
    if (session.status === "pending") session.status = "in_progress";
    await write(db);
    return { ok: true, value: null };
  });
}

export async function recordFactByToken(
  token: string,
  fact: { fact_id: string; value: string; verbatim: string; block_id: string; turn_index: number },
): Promise<TokenResult<null>> {
  return serialize(async () => {
    const db = await read();
    const found = openSession(db, token);
    if (!found.ok) return found;
    const session = found.value;
    const existing = db.facts.find(
      (f) =>
        f.session_id === session.id &&
        f.block_id === fact.block_id &&
        f.fact_id === fact.fact_id,
    );
    if (existing) {
      // Never move a fact the caseworker has already accepted.
      if (!existing.accepted) {
        existing.value = fact.value;
        existing.verbatim = fact.verbatim;
        existing.turn_index = fact.turn_index;
      }
    } else {
      db.facts.push({
        ...fact,
        id: randomUUID(),
        session_id: session.id,
        accepted: false,
        accepted_at: null,
        accepted_by: null,
      });
    }
    await write(db);
    return { ok: true, value: null };
  });
}

export async function completeByToken(token: string): Promise<TokenResult<null>> {
  return serialize(async () => {
    const db = await read();
    const session = db.sessions.find((s) => s.link_token === token);
    if (!session || !isLive(session)) return { ok: false, reason: "invalid" };
    if (session.status === "complete") return { ok: true, value: null };
    if (session.status === "reviewed") return { ok: false, reason: "closed" };
    session.status = "complete";
    session.completed_at = now();
    await write(db);
    return { ok: true, value: null };
  });
}
