/**
 * POST /api/interview/[token]/turn — persist one transcript turn.
 *
 * Public: the token is the only credential. Called the moment each turn
 * completes so a browser that dies at question 8 has questions 1–7 on disk.
 */

import { NextResponse } from "next/server";
import { turnRequestSchema } from "@/lib/interview-schemas";
import { appendTurnByToken } from "@/lib/interview-store";
import { fieldErrors } from "@/lib/validation";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  const { token } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = turnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const now = new Date().toISOString();
  const result = await appendTurnByToken(token, {
    turn_index: parsed.data.turn_index,
    speaker: parsed.data.speaker,
    text: parsed.data.text,
    started_at: parsed.data.started_at ?? now,
    ended_at: parsed.data.ended_at ?? now,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "closed" ? "This interview is closed." : "This link is no longer valid." },
      { status: result.reason === "closed" ? 409 : 410 },
    );
  }
  return NextResponse.json({ ok: true });
}
