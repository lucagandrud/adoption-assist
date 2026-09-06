/**
 * Session.
 *
 * Two mechanisms behind one question — "who is signed in?":
 *
 *   Supabase   the Supabase Auth cookie, revalidated against the server on
 *              every read (getUser(), not getSession()). A real security
 *              boundary: the JWT is verified and row-level security scopes
 *              every query to that user.
 *
 *   Local      an httpOnly cookie holding a user id, checked against the JSON
 *              store. This is an identity, not a security boundary — anything
 *              that can write a cookie can be anyone. Fine for local dev with
 *              synthetic data; not fine for anything else.
 *
 * Every screen asks this module rather than reading cookies itself, so the
 * two paths never leak into the UI.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase";
import { currentSupabaseUser, findUserById, signOutBackend } from "@/lib/store";
import type { UserRecord } from "@/lib/types";

export const SESSION_COOKIE = "icpc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

/** No-op under Supabase, which sets its own cookies during sign-in. */
export async function setSession(userId: string): Promise<void> {
  if (isSupabaseConfigured()) return;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  await signOutBackend();
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<UserRecord | null> {
  if (isSupabaseConfigured()) return currentSupabaseUser();

  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return findUserById(id);
}

/** For server components. Sends anonymous visitors to the sign-in screen. */
export async function requireUser(): Promise<UserRecord> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
