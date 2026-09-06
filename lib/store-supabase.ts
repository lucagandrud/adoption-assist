/**
 * Supabase storage backend — Postgres, Auth, and row-level security.
 *
 * Active when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are
 * set. See docs/supabase-setup.md and supabase/migrations/0001_init.sql.
 *
 * WHY THIS IS DIFFERENT FROM THE JSON STORE, beyond durability: isolation is
 * enforced by the DATABASE, not by this file. Every policy in the migration is
 * `auth.uid() = owner_user_id`, so even a bug in a route handler that forgot
 * to filter by user cannot return another caseworker's cases — Postgres will
 * not hand them over. The `.eq("owner_user_id", userId)` calls below are
 * belt-and-braces, not the security boundary.
 *
 * Server-only. Never import from a client component.
 */

import { randomUUID } from "node:crypto";
import { supabaseServerClient } from "@/lib/supabase";
import type { CaseDocumentRecord, CaseRecord, UserRecord } from "@/lib/types";
import type {
  AuthResult,
  CaseInput,
  DocumentInput,
  SignInInput,
  SignUpInput,
} from "@/lib/store-types";
import { SEED_CASES, addDays, isoOffsetFromToday } from "@/lib/seed-cases";

/** profiles row shape; see supabase/migrations/0001_init.sql. */
interface ProfileRow {
  id: string;
  name: string;
  email: string;
  agency: string;
  created_at: string;
  last_seen_at: string;
}

function toUser(row: ProfileRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    agency: row.agency,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
  };
}

/* --------------------------------- auth ----------------------------------- */

/**
 * The signed-in caseworker, from the Supabase session cookie.
 *
 * getUser() revalidates the JWT against Supabase rather than trusting the
 * cookie's claims — getSession() would not, and a forged cookie would sail
 * straight through.
 */
export async function currentUser(): Promise<UserRecord | null> {
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single<ProfileRow>();

  if (profile) return toUser(profile);

  // The signup trigger should have made this row. If it is missing, fall back
  // to auth metadata so a caseworker is never locked out by a trigger failure.
  return {
    id: data.user.id,
    name: (data.user.user_metadata?.name as string) ?? "",
    email: data.user.email ?? "",
    agency: (data.user.user_metadata?.agency as string) ?? "",
    created_at: data.user.created_at,
    last_seen_at: new Date().toISOString(),
  };
}

/** Kept for interface parity with the JSON backend. */
export async function findUserById(id: string): Promise<UserRecord | null> {
  const user = await currentUser();
  return user && user.id === id ? user : null;
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const supabase = await supabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    // Read by handle_new_user() to populate the profiles row.
    options: { data: { name: input.name.trim(), agency: input.agency.trim() } },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign-up failed. Try again." };

  // Email confirmation on means no session yet. Say so plainly rather than
  // bouncing to a caseload the caseworker cannot reach.
  if (!data.session) {
    return {
      error:
        "Account created. Check your email to confirm it, then sign in. " +
        "(Turn off email confirmation in Supabase to skip this during the demo.)",
    };
  }

  await seedCaseload(data.user.id);

  const user = await currentUser();
  return user ? { user } : { error: "Signed up, but the profile did not load." };
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
  const supabase = await supabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    return { error: "That email and password do not match an account." };
  }

  const user = await currentUser();
  if (!user) return { error: "Signed in, but the profile did not load." };

  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  return { user };
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServerClient();
  await supabase.auth.signOut();
}

/* --------------------------------- cases ---------------------------------- */

export async function listCases(userId: string): Promise<CaseRecord[]> {
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as CaseRecord[];
}

export async function findCase(
  userId: string,
  caseId: string,
): Promise<CaseRecord | null> {
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("id", caseId)
    .maybeSingle();
  return (data as CaseRecord | null) ?? null;
}

export async function createCase(
  userId: string,
  input: CaseInput,
): Promise<CaseRecord> {
  const supabase = await supabaseServerClient();

  // Docket ids come from a Postgres sequence via next_case_id(), so two
  // caseworkers opening a case at the same moment cannot collide on a number.
  const { data: id, error: idError } = await supabase.rpc("next_case_id");
  if (idError || !id) {
    throw new Error(`Could not allocate a case number: ${idError?.message}`);
  }

  const row = {
    id: id as string,
    owner_user_id: userId,
    ...input,
    completion_pct: 0,
    next_deadline: addDays(input.window_start, 30),
    next_deadline_label: "Initial packet assembly",
  };

  const { data, error } = await supabase
    .from("cases")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Could not open the case: ${error.message}`);
  return data as CaseRecord;
}

export async function updateCase(
  userId: string,
  caseId: string,
  patch: Partial<CaseInput>,
): Promise<CaseRecord | null> {
  const supabase = await supabaseServerClient();
  const { data } = await supabase
    .from("cases")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("owner_user_id", userId)
    .eq("id", caseId)
    .select()
    .maybeSingle();
  return (data as CaseRecord | null) ?? null;
}

export async function deleteCase(
  userId: string,
  caseId: string,
): Promise<boolean> {
  const supabase = await supabaseServerClient();
  const { error, count } = await supabase
    .from("cases")
    .delete({ count: "exact" })
    .eq("owner_user_id", userId)
    .eq("id", caseId);
  return !error && (count ?? 0) > 0;
}

/* ------------------------------- documents ------------------------------ */

export async function listCaseDocuments(
  userId: string,
  caseId: string,
): Promise<CaseDocumentRecord[]> {
  const ownsCase = await findCase(userId, caseId);
  if (!ownsCase) return [];

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: true });
  if (error) throw new Error(`Could not load case documents: ${error.message}`);
  return (data ?? []) as CaseDocumentRecord[];
}

export async function saveCaseDocument(
  userId: string,
  caseId: string,
  input: DocumentInput,
): Promise<CaseDocumentRecord | null> {
  const ownsCase = await findCase(userId, caseId);
  if (!ownsCase) return null;

  const supabase = await supabaseServerClient();
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("case_id", caseId)
    .eq("definition_id", input.definition_id)
    .maybeSingle<{ id: string }>();

  const row = {
    id: existing?.id ?? `case-doc-${randomUUID().slice(0, 8)}`,
    case_id: caseId,
    uploaded_at: new Date().toISOString(),
    ...input,
  };
  const { data, error } = await supabase
    .from("documents")
    .upsert(row, { onConflict: "case_id,definition_id" })
    .select()
    .single();
  if (error) throw new Error(`Could not save case document: ${error.message}`);
  return data as CaseDocumentRecord;
}

export async function clearCaseDocuments(
  userId: string,
  caseId: string,
): Promise<boolean> {
  const ownsCase = await findCase(userId, caseId);
  if (!ownsCase) return false;

  const supabase = await supabaseServerClient();
  const { error } = await supabase.from("documents").delete().eq("case_id", caseId);
  if (error) throw new Error(`Could not clear case documents: ${error.message}`);
  return true;
}

/* --------------------------------- seed ----------------------------------- */

/** Gives a brand-new account the same starting board as the JSON backend. */
async function seedCaseload(userId: string): Promise<void> {
  const supabase = await supabaseServerClient();

  const rows = [];
  for (const seed of SEED_CASES) {
    const { data: id } = await supabase.rpc("next_case_id");
    if (!id) continue;
    rows.push({
      id: id as string,
      owner_user_id: userId,
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
    });
  }

  if (rows.length) await supabase.from("cases").insert(rows);
}
