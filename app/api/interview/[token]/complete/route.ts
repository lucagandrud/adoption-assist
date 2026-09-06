/** POST /api/interview/[token]/complete — close the session. Idempotent. */

import { NextResponse } from "next/server";
import { completeByToken } from "@/lib/interview-store";

type Context = { params: Promise<{ token: string }> };

export async function POST(_request: Request, context: Context) {
  const { token } = await context.params;
  const result = await completeByToken(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "closed" ? "This interview is closed." : "This link is no longer valid." },
      { status: result.reason === "closed" ? 409 : 410 },
    );
  }
  return NextResponse.json({ ok: true });
}
