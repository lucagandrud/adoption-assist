/**
 * Local JSON-file storage backend.
 *
 * The zero-configuration path: clone, `npm run dev`, sign up, and your cases
 * survive a restart with no Supabase project, no Docker, no env vars. This is
 * what runs when NEXT_PUBLIC_SUPABASE_URL is unset.
 *
 * Server-only. Never import from a client component.
 *
 * PASSWORDS: hashed with scrypt so the file never holds a plaintext secret,
 * but this is a local development store for synthetic accounts — it is not a
 * security boundary and it is not where a real caseworker's credentials
 * belong. Supabase Auth is that (lib/store-supabase.ts).
 *
 * The file lives in .data/ and is gitignored. Per CLAUDE.md hard boundary #3,
 * only synthetic case data belongs here.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { CaseRecord, UserRecord } from "@/lib/types";
import type { AuthResult, CaseInput, SignInInput, SignUpInput } from "@/lib/store-types";
import {
  SEED_CASES,
  addDays,
  formatCaseId,
  isoOffsetFromToday,
  FIRST_CASE_SEQ,
} from "@/lib/seed-cases";

interface StoredUser extends UserRecord {
  password_hash: string;
}

interface Database {
  version: 1;
  users: StoredUser[];
  cases: CaseRecord[];
  next_case_seq: number;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "workbench.json");

const EMPTY: Database = {
  version: 1,
  users: [],
  cases: [],
  next_case_seq: FIRST_CASE_SEQ,
};

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
      // existing .data/ keeps working instead of rendering NaN.
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

/**
 * Next docket number to hand out.
 *
 * Derived from the cases actually present, not read straight off the stored
 * counter. The counter alone is not enough: if .data/ is deleted or a write
 * interleaves, it restarts at FIRST_CASE_SEQ and starts minting ids that
 * already exist — two placements sharing one docket number, which is exactly
 * the collision the format is supposed to prevent.
 *
 * Taking the max of (stored counter, highest id in use) makes the store
 * self-healing: a reset counter is corrected by the data, and gaps from
 * deleted cases are never reused.
 *
 * Postgres does not need this — next_case_id() draws from a real sequence.
 */
function nextSeq(db: Database): number {
  let highest = 0;
  for (const c of db.cases) {
    const match = /-(\d+)$/.exec(c.id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return Math.max(db.next_case_seq, highest + 1, FIRST_CASE_SEQ);
}

/* ------------------------------- passwords -------------------------------- */

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}

/** Strips the hash before a user record leaves this module. */
function publicUser(u: StoredUser): UserRecord {
  const { password_hash: _hash, ...rest } = u;
  void _hash;
  return rest;
}

/* --------------------------------- auth ----------------------------------- */

export async function findUserById(id: string): Promise<UserRecord | null> {
  const db = await read();
  const found = db.users.find((u) => u.id === id);
  return found ? publicUser(found) : null;
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  return serialize(async () => {
    const db = await read();
    const email = input.email.trim().toLowerCase();

    if (db.users.some((u) => u.email === email)) {
      return { error: "An account already exists for that email. Sign in instead." };
    }

    const user: StoredUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      agency: input.agency.trim(),
      created_at: now(),
      last_seen_at: now(),
      password_hash: hashPassword(input.password),
    };
    db.users.push(user);

    db.next_case_seq = nextSeq(db);
    for (const seed of SEED_CASES) {
      db.cases.push({
        id: formatCaseId(db.next_case_seq, new Date().getFullYear()),
        owner_user_id: user.id,
        label: seed.label,
        sending_state: seed.sending_state,
        receiving_state: seed.receiving_state,
        relationship: seed.relationship,
        children_count: seed.children_count,
        placement_type: seed.placement_type,
        window_start: isoOffsetFromToday(seed.window_offset_days),
        completion_pct: seed.completion_pct,
        next_deadline: isoOffsetFromToday(seed.deadline_offset_days),
        next_deadline_label: seed.next_deadline_label,
        created_at: now(),
        updated_at: now(),
      });
      db.next_case_seq += 1;
    }

    await write(db);
    return { user: publicUser(user) };
  });
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
  return serialize(async () => {
    const db = await read();
    const email = input.email.trim().toLowerCase();
    const found = db.users.find((u) => u.email === email);

    // Same message for "no such account" and "wrong password" so the form does
    // not confirm which emails have accounts.
    const REJECT = { error: "That email and password do not match an account." };
    if (!found) return REJECT;
    if (!verifyPassword(input.password, found.password_hash)) return REJECT;

    found.last_seen_at = now();
    await write(db);
    return { user: publicUser(found) };
  });
}

/* --------------------------------- cases ---------------------------------- */

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

export async function createCase(
  userId: string,
  input: CaseInput,
): Promise<CaseRecord> {
  return serialize(async () => {
    const db = await read();
    const seq = nextSeq(db);
    db.next_case_seq = seq + 1;

    const record: CaseRecord = {
      id: formatCaseId(seq, new Date().getFullYear()),
      owner_user_id: userId,
      created_at: now(),
      updated_at: now(),
      // Nothing is verified on a new case. Once /engines/graph.ts lands this
      // is derived from the GraphModel rather than stored.
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
