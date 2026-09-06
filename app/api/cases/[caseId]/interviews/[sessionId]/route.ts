/**
 * One interview session — caseworker side.
 *
 *   GET    session + transcript + draft facts
 *   PATCH  { status: "reviewed" } once every required field is accepted
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import {
  findSession,
  listFacts,
  listTurns,
  markReviewed,
} from "@/lib/interview-store";

type Context = { params: Promise<{ caseId: string; sessionId: string }> };

const patchSchema = z.object({ status: z.literal("reviewed") });

export async function GET(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { caseId, sessionId } = await context.params;
  const session = await findSession(user.id, caseId, sessionId);
  if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  const [turns, facts] = await Promise.all([
    listTurns(user.id, sessionId),
    listFacts(user.id, sessionId),
  ]);
  return NextResponse.json({ session, turns, facts });
}

export async function PATCH(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!patchSchema.safeParse(body).success) {
    return NextResponse.json({ error: "Only status: reviewed is accepted." }, { status: 422 });
  }

  const { caseId, sessionId } = await context.params;
  const session = await findSession(user.id, caseId, sessionId);
  if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });

  const ok = await markReviewed(user.id, sessionId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
