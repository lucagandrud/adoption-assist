/**
 * Persistence facade.
 *
 * Picks a backend at runtime and re-exports one interface, so no screen or
 * route handler knows which one is live:
 *
 *   Supabase  when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY are set
 *             Postgres, real auth, row-level security. See
 *             docs/supabase-setup.md.
 *
 *   JSON file otherwise — the zero-config path. Clone, `npm run dev`, sign up,
 *             and cases survive a restart with no project to provision.
 *
 * Keeping the JSON path alive is deliberate: the demo must still run if the
 * Supabase project is unreachable on conference wifi, and a teammate cloning
 * the repo should not need credentials to see the app work.
 *
 * Server-only. Never import this from a client component.
 */

import { isSupabaseConfigured } from "@/lib/supabase";
import * as json from "@/lib/store-json";
import * as supa from "@/lib/store-supabase";
import type { CaseRecord, UserRecord } from "@/lib/types";
import type {
  AuthResult,
  CaseInput,
  SignInInput,
  SignUpInput,
} from "@/lib/store-types";

export type { CaseInput, SignInInput, SignUpInput, AuthResult };
export { isAuthError } from "@/lib/store-types";

/** Which backend is live. Surfaced in the UI so the state is never a mystery. */
export function backendName(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}

/* --------------------------------- auth ----------------------------------- */

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  return isSupabaseConfigured() ? supa.signUp(input) : json.signUp(input);
}

export async function signIn(input: SignInInput): Promise<AuthResult> {
  return isSupabaseConfigured() ? supa.signIn(input) : json.signIn(input);
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  return isSupabaseConfigured()
    ? supa.findUserById(id)
    : json.findUserById(id);
}

/** Supabase owns its own session cookies; the JSON backend uses lib/session.ts. */
export async function signOutBackend(): Promise<void> {
  if (isSupabaseConfigured()) await supa.signOut();
}

/** The signed-in caseworker under Supabase Auth. Null on the JSON backend. */
export async function currentSupabaseUser(): Promise<UserRecord | null> {
  return isSupabaseConfigured() ? supa.currentUser() : null;
}

/* --------------------------------- cases ---------------------------------- */

export async function listCases(userId: string): Promise<CaseRecord[]> {
  return isSupabaseConfigured() ? supa.listCases(userId) : json.listCases(userId);
}

export async function findCase(
  userId: string,
  caseId: string,
): Promise<CaseRecord | null> {
  return isSupabaseConfigured()
    ? supa.findCase(userId, caseId)
    : json.findCase(userId, caseId);
}

export async function createCase(
  userId: string,
  input: CaseInput,
): Promise<CaseRecord> {
  return isSupabaseConfigured()
    ? supa.createCase(userId, input)
    : json.createCase(userId, input);
}

export async function updateCase(
  userId: string,
  caseId: string,
  patch: Partial<CaseInput>,
): Promise<CaseRecord | null> {
  return isSupabaseConfigured()
    ? supa.updateCase(userId, caseId, patch)
    : json.updateCase(userId, caseId, patch);
}

export async function deleteCase(
  userId: string,
  caseId: string,
): Promise<boolean> {
  return isSupabaseConfigured()
    ? supa.deleteCase(userId, caseId)
    : json.deleteCase(userId, caseId);
}
