/**
 * Sign in / sign out / who am I.
 * Identify-or-create against lib/store; see lib/session.ts on why this is an
 * identity rather than authentication.
 */

import { NextResponse } from "next/server";
import { signInSchema, fieldErrors } from "@/lib/validation";
import { signInUser } from "@/lib/store";
import { clearSession, getSessionUser, setSession } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const user = await signInUser(parsed.data);
  await setSession(user.id);
  return NextResponse.json({ user });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
