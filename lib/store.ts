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
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "workbench.json");

const EMPTY: Database = { version: 1, users: [], cases: [] };

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
      cases: parsed.cases ?? [],
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
    db.cases.push(seedCase(user.id));
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
  "id" | "owner_user_id" | "created_at" | "updated_at"
>;

export async function createCase(
  userId: string,
  input: CaseInput,
): Promise<CaseRecord> {
  return serialize(async () => {
    const db = await read();
    const record: CaseRecord = {
      id: `case-${randomUUID().slice(0, 8)}`,
      owner_user_id: userId,
      created_at: now(),
      updated_at: now(),
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

/**
 * Every new caseworker gets one synthetic case so the workflow screen has
 * something to render immediately. Fictional family; see CLAUDE.md #3.
 */
function seedCase(userId: string): CaseRecord {
  return {
    id: `case-${randomUUID().slice(0, 8)}`,
    owner_user_id: userId,
    label: "Demo Case — Rivera",
    sending_state: "CA",
    receiving_state: "TX",
    relationship: "relative",
    children_count: 2,
    placement_type: "foster",
    window_start: new Date().toISOString().slice(0, 10),
    created_at: now(),
    updated_at: now(),
  };
}
