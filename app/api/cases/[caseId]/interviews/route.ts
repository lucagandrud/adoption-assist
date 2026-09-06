/**
 * Interview sessions for one case — caseworker side.
 *
 *   GET   list sessions (with link tokens; this caller owns the case)
 *   POST  dispatch a new interview: mints a session and its 7-day link
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { findCase } from "@/lib/store";
import { createSession, listSessions } from "@/lib/interview-store";
import { createSessionSchema } from "@/lib/interview-schemas";
import { getScript } from "@/lib/interview-scripts";
import { fieldErrors } from "@/lib/validation";

type Context = { params: Promise<{ caseId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { caseId } = await context.params;
  if (!(await findCase(user.id, caseId))) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  return NextResponse.json({ sessions: await listSessions(user.id, caseId) });
}

export async function POST(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }
  if (!getScript(parsed.data.script_id)) {
    return NextResponse.json({ errors: { script_id: "Unknown interview script." } }, { status: 422 });
  }

  const { caseId } = await context.params;
  if (!(await findCase(user.id, caseId))) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const session = await createSession(user.id, caseId, parsed.data);
  if (!session) {
    return NextResponse.json({ error: "Could not create the interview." }, { status: 500 });
  }
  return NextResponse.json({ session }, { status: 201 });
}
