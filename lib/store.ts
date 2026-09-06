/**
 * Persistence.
 *
 * Deliberately a small JSON-file store, not Supabase, so the app runs with
 * zero configuration: clone, `npm run dev`, sign in, and your cases are still
 * there after a restart. Every read/write goes through this module, so the
 * swap to Supabase is one file (see lib/supabase.ts) and no caller changes.
 *
 * Server-only. Never import this from a client component.
 *
 * NOTE: the file lives in .data/ and is gitignored. Per CLAUDE.md hard
 * boundary #3, only synthetic case data belongs here.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CaseRecord, UserRecord } from "@/lib/types";

interface Database {
  version: 1;
  users: UserRecord[];
  cases: CaseRecord[];
  /** Next docket sequence to allocate. See allocateCaseId(). */
  next_case_seq: number;
}

/**
 * Case IDs are docket numbers, not slugs: ICPC-2026-0231.
 *
 * Sequential and per-year, because a caseworker reads this number over the
 * phone to another state's ICPC office and writes it on a physical folder. A
 * random hex slug fails both of those jobs.
 *
 * The counter lives in the store so numbers are never reused. When this moves
 * to Postgres it becomes a sequence; the format stays.
 */
const CASE_ID_PREFIX = "ICPC";

function formatCaseId(seq: number, year: number): string {
  return `${CASE_ID_PREFIX}-${year}-${String(seq).padStart(4, "0")}`;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "workbench.json");

const EMPTY: Database = { version: 1, users: [], cases: [], next_case_seq: 231 };

/** Serializes read-modify-write cycles so two requests cannot clobber. */
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
      users: parsed.users ?? [],
      // Backfill fields added after a store file was first written, so an
      // existing .data/ from an earlier run keeps working instead of rendering
      // NaN. Cheap here; drop it once this moves to Postgres with migrations.
      cases: (parsed.cases ?? []).map((c) => ({
        ...c,
        completion_pct: c.completion_pct ?? 0,
        next_deadline: c.next_deadline ?? addDays(c.window_start, 30),
        next_deadline_label: c.next_deadline_label ?? "Initial packet assembly",
      })),
      next_case_seq: parsed.next_case_seq ?? EMPTY.next_case_seq,
    };
  } catch {
    return { ...EMPTY };
  }
}

async function write(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
}

const now = () => new Date().toISOString();

/* --------------------------------- users --------------------------------- */

export async function findUserById(id: string): Promise<UserRecord | null> {
  const db = await read();
  return db.users.find((u) => u.id === id) ?? null;
}

/**
 * Sign-in is identify-or-create: a caseworker types name + email and gets a
 * durable identity. Not authentication — there is no password and no secret.
 * Real auth is Supabase (handoff Step 4); this keeps the shell honest and
 * working in the meantime.
 */
export async function signInUser(input: {
  name: string;
  email: string;
  agency: string;
}): Promise<UserRecord> {
  return serialize(async () => {
    const db = await read();
    const email = input.email.trim().toLowerCase();
    const existing = db.users.find((u) => u.email === email);

    if (existing) {
      existing.name = input.name.trim();
      existing.agency = input.agency.trim() || existing.agency;
      existing.last_seen_at = now();
      await write(db);
      return existing;
    }

    const user: UserRecord = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      agency: input.agency.trim(),
      created_at: now(),
      last_seen_at: now(),
    };
    db.users.push(user);
    for (const record of seedCaseload(user.id, db.next_case_seq)) {
      db.cases.push(record);
      db.next_case_seq += 1;
    }
    await write(db);
    return user;
  });
}

/* --------------------------------- cases --------------------------------- */

export async function listCases(userId: string): Promise<CaseRecord[]> {
  const db = await read();
  return db.cases
    .filter((c) => c.owner_user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function findCase(
  userId: string,
  caseId: string,
): Promise<CaseRecord | null> {
  const db = await read();
  return (
    db.cases.find((c) => c.id === caseId && c.owner_user_id === userId) ?? null
  );
}

export type CaseInput = Omit<
  CaseRecord,
  | "id"
  | "owner_user_id"
  | "created_at"
  | "updated_at"
  | "completion_pct"
  | "next_deadline"
  | "next_deadline_label"
>;

export async function createCase(
  userId: string,
  input: CaseInput,
): Promise<CaseRecord> {
  return serialize(async () => {
    const db = await read();
    const seq = db.next_case_seq;
    db.next_case_seq = seq + 1;

    const record: CaseRecord = {
      id: formatCaseId(seq, new Date().getFullYear()),
      owner_user_id: userId,
      created_at: now(),
      updated_at: now(),
      // A new case has nothing verified yet. Once /engines/graph.ts lands,
      // this is derived from the GraphModel rather than stored.
      completion_pct: 0,
      next_deadline: addDays(input.window_start, 30),
      next_deadline_label: "Initial packet assembly",
      ...input,
    };
    db.cases.push(record);
    await write(db);
    return record;
  });
}

/** Calendar-day arithmetic on an ISO date, kept off the Date-timezone rake. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function updateCase(
  userId: string,
  caseId: string,
  patch: Partial<CaseInput>,
): Promise<CaseRecord | null> {
  return serialize(async () => {
    const db = await read();
    const record = db.cases.find(
      (c) => c.id === caseId && c.owner_user_id === userId,
    );
    if (!record) return null;
    Object.assign(record, patch, { updated_at: now() });
    await write(db);
    return record;
  });
}

export async function deleteCase(
  userId: string,
  caseId: string,
): Promise<boolean> {
  return serialize(async () => {
    const db = await read();
    const index = db.cases.findIndex(
      (c) => c.id === caseId && c.owner_user_id === userId,
    );
    if (index === -1) return false;
    db.cases.splice(index, 1);
    await write(db);
    return true;
  });
}

/**
 * Every new caseworker gets a caseload of five synthetic cases at different
 * stages, so the grid shows what a real workload looks like: a couple of cases
 * barely started and dominating the screen, a few mid-flight, one finished and
 * pushed out of the way.
 *
 * ALL FAMILIES ARE FICTIONAL. CLAUDE.md hard boundary #3 — no real records,
 * ever, not even to test with.
 */
function seedCaseload(userId: string, startSeq: number): CaseRecord[] {
  const year = new Date().getFullYear();
  const today = new Date();
  const anchor = (offsetDays: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const seeds: Array<Omit<CaseRecord, "id" | "owner_user_id" | "created_at" | "updated_at">> = [
    {
      label: "Alvarez",
      sending_state: "CA",
      receiving_state: "TX",
      relationship: "relative",
      children_count: 3,
      placement_type: "foster",
      window_start: anchor(-12),
      completion_pct: 12,
      next_deadline: anchor(6),
      next_deadline_label: "Fingerprint appointment",
    },
    {
      label: "Whitfield",
      sending_state: "TX",
      receiving_state: "CA",
      relationship: "parent",
      children_count: 1,
      placement_type: "foster",
      window_start: anchor(-38),
      completion_pct: 34,
      next_deadline: anchor(11),
      next_deadline_label: "Income verification due",
    },
    {
      label: "Nakamura",
      sending_state: "CA",
      receiving_state: "TX",
      relationship: "non_relative",
      children_count: 2,
      placement_type: "adoption",
      window_start: anchor(-71),
      completion_pct: 58,
      next_deadline: anchor(19),
      next_deadline_label: "Home study walkthrough",
    },
    {
      label: "Boateng",
      sending_state: "TX",
      receiving_state: "CA",
      relationship: "relative",
      children_count: 2,
      placement_type: "foster",
      window_start: anchor(-104),
      completion_pct: 81,
      next_deadline: anchor(27),
      next_deadline_label: "Medical clearance renewal",
    },
    {
      label: "Rivera",
      sending_state: "CA",
      receiving_state: "TX",
      relationship: "relative",
      children_count: 2,
      placement_type: "foster",
      window_start: anchor(-149),
      completion_pct: 100,
      next_deadline: anchor(-3),
      next_deadline_label: "Packet filed",
    },
  ];

  return seeds.map((seed, i) => ({
    id: formatCaseId(startSeq + i, year),
    owner_user_id: userId,
    created_at: now(),
    updated_at: now(),
    ...seed,
  }));
}
