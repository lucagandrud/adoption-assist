/**
 * Sign in / sign up / sign out / who am I.
 *
 * The storage backend decides what these mean: Supabase Auth when configured,
 * the local JSON store otherwise. See lib/store.ts. Nothing in this file knows
 * which is live.
 */

import { NextResponse } from "next/server";
import { signInSchema, signUpSchema, fieldErrors } from "@/lib/validation";
import { signIn, signUp, isAuthError, backendName } from "@/lib/store";
import { clearSession, getSessionUser, setSession } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user, backend: backendName() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const intent =
    typeof body === "object" && body !== null && "intent" in body
      ? (body as { intent?: string }).intent
      : undefined;

  if (intent === "signup") {
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: fieldErrors(parsed.error) },
        { status: 422 },
      );
    }

    const result = await signUp({ ...parsed.data, agency: parsed.data.agency ?? "" });
    if (isAuthError(result)) {
      return NextResponse.json({ errors: { _form: result.error } }, { status: 401 });
    }

    await setSession(result.user.id);
    return NextResponse.json({ user: result.user });
  }

  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const result = await signIn(parsed.data);
  if (isAuthError(result)) {
    return NextResponse.json({ errors: { _form: result.error } }, { status: 401 });
  }

  await setSession(result.user.id);
  return NextResponse.json({ user: result.user });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
