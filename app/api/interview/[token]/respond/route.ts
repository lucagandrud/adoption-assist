/**
 * POST /api/interview/[token]/respond — one answer in, facts out.
 *
 * Body: { block_id, utterance, turn_index, clarifications_used }
 * Reply: InterviewResponse — { facts, needs_clarification, clarifying_question, acknowledgment }
 *
 * The block id must belong to the session's script; the model is handed
 * that block and nothing about what comes next. Facts are filtered to the
 * block's target_facts and the clarification cap is re-applied here even
 * though the client also enforces it — a client cannot talk this route into
 * a loop.
 *
 * When extraction is unavailable (no API key, network down, unparseable
 * reply) the route returns 503 with a reason and the room ADVANCES. The
 * transcript is still persisted by /turn; only the draft facts are lost for
 * that answer, and the caseworker sees the verbatim text regardless.
 */

import { NextResponse } from "next/server";
import { respondRequestSchema } from "@/lib/interview-schemas";
import { getSessionByToken, recordFactByToken } from "@/lib/interview-store";
import { getScript } from "@/lib/interview-scripts";
import { extractInterviewFacts } from "@/lib/interview-extractor";
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

  const parsed = respondRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: "This link is no longer valid." }, { status: 410 });
  }
  if (session.status === "complete" || session.status === "reviewed") {
    return NextResponse.json({ error: "This interview is closed." }, { status: 409 });
  }

  const script = getScript(session.script_id);
  const block = script?.blocks.find((b) => b.id === parsed.data.block_id);
  if (!script || !block) {
    return NextResponse.json({ error: "Unknown question." }, { status: 422 });
  }

  const result = await extractInterviewFacts({
    block,
    utterance: parsed.data.utterance,
    clarificationsUsed: parsed.data.clarifications_used,
  });

  if (!result.ok) {
    // Logged server-side so the reason is findable; the subject's page gets
    // a neutral status and moves on.
    console.warn(`[interview/respond] extraction unavailable: ${result.reason} — ${result.detail}`);
    return NextResponse.json(
      { error: "extraction_unavailable", reason: result.reason, detail: result.detail },
      { status: 503 },
    );
  }

  // Persist drafts now, one row per fact, each pointing at the utterance
  // that produced it. accepted stays false — only a caseworker flips it.
  for (const fact of result.response.facts) {
    await recordFactByToken(token, {
      fact_id: fact.fact_id,
      value: fact.value,
      verbatim: fact.verbatim,
      block_id: block.id,
      turn_index: parsed.data.turn_index,
    });
  }

  return NextResponse.json(result.response);
}
