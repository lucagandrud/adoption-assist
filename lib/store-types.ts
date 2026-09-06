/**
 * The storage contract.
 *
 * Both backends implement exactly this: lib/store-json.ts (local file, zero
 * config) and lib/store-supabase.ts (Postgres + Auth + row-level security).
 * lib/store.ts picks one at runtime. No screen or route handler imports a
 * backend directly, so swapping is a config change rather than a refactor.
 */

import type { CaseRecord, UserRecord } from "@/lib/types";

/**
 * Fields a caller supplies when opening a case. The rest — docket id, owner,
 * timestamps, completion and deadline — are assigned by the backend, so a
 * client can never forge them.
 */
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

export interface SignUpInput {
  name: string;
  email: string;
  agency: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

/**
 * Auth returns a rejection message rather than throwing, because every failure
 * here is a thing the form has to render. `error` is deliberately vague on
 * sign-in so the screen never confirms which emails have accounts.
 */
export type AuthResult = { user: UserRecord } | { error: string };

export function isAuthError(
  result: AuthResult,
): result is { error: string } {
  return "error" in result;
}
