/**
 * POST /api/cases/[caseId]/interviews/seed-demo
 *
 * Loads the three fictional interviews from demo/interviews/sessions.json
 * onto this case as completed sessions with draft facts. Idempotent by
 * subject name. Every fact arrives unaccepted: the caseworker still has to
 * accept each one on the review page before it reaches the workflow.
 */

import { NextResponse } from "next/server";
import demo from "@/demo/interviews/sessions.json";
import { getSessionUser } from "@/lib/session";
import { findCase } from "@/lib/store";
import { createSession, insertTranscript, listSessions } from "@/lib/interview-store";
import type { InterviewSession, InterviewTurn } from "@/lib/types";

type Context = { params: Promise<{ caseId: string }> };

interface DemoSession {
  subject_name: string;
  subject_role: string;
  script_id: string;
  status: InterviewSession["status"];
  turns: InterviewTurn[];
  facts: { fact_id: string; value: string; verbatim: string; block_id: string; turn_index: number }[];
}

export async function POST(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { caseId } = await context.params;
  if (!(await findCase(user.id, caseId))) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const existing = new Set((await listSessions(user.id, caseId)).map((s) => s.subject_name));
  let created = 0;
  for (const fixture of demo.sessions as DemoSession[]) {
    if (existing.has(fixture.subject_name)) continue;
    const session = await createSession(user.id, caseId, {
      subject_name: fixture.subject_name,
      subject_role: fixture.subject_role,
      script_id: fixture.script_id,
    });
    if (!session) continue;
    const ok = await insertTranscript(user.id, session.id, fixture.turns, fixture.facts, fixture.status);
    if (ok) created += 1;
  }

  return NextResponse.json({ created, skipped: demo.sessions.length - created });
}
