/**
 * Session.
 *
 * A signed-in caseworker is an httpOnly cookie holding a user id. This is an
 * identity, not authentication: there is no password and nothing here is a
 * security boundary. Supabase Auth replaces it (handoff Step 4) without any
 * caller changing — every screen asks this module who the user is.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/store";
import type { UserRecord } from "@/lib/types";

export const SESSION_COOKIE = "icpc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export async function setSession(userId: string): Promise<void> {
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
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<UserRecord | null> {
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
