/**
 * Accept or un-accept one draft fact — the ONLY path that flips `accepted`.
 *
 *   PATCH   { value?: string }  accept, optionally with a corrected value
 *   DELETE                      revoke acceptance (the row stays as a draft)
 *
 * Caseworker-only: the session must belong to a case this user owns. The
 * subject's token has no route that reaches this column (CLAUDE.md §4a.3).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { acceptFact, findSession, revokeFact } from "@/lib/interview-store";
import { acceptFactSchema } from "@/lib/interview-schemas";
import { fieldErrors } from "@/lib/validation";

type Context = { params: Promise<{ caseId: string; sessionId: string; factId: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const parsed = acceptFactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const { caseId, sessionId, factId } = await context.params;
  if (!(await findSession(user.id, caseId, sessionId))) {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }

  const fact = await acceptFact(user.id, sessionId, factId, parsed.data.value);
  if (!fact) return NextResponse.json({ error: "Fact not found." }, { status: 404 });
  return NextResponse.json({ fact });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { caseId, sessionId, factId } = await context.params;
  if (!(await findSession(user.id, caseId, sessionId))) {
    return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  }
  const fact = await revokeFact(user.id, sessionId, factId);
  if (!fact) return NextResponse.json({ error: "Fact not found." }, { status: 404 });
  return NextResponse.json({ fact });
}
