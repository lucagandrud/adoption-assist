/** Read, amend, or delete one case. */

import { NextResponse } from "next/server";
import { casePatchSchema, fieldErrors } from "@/lib/validation";
import { deleteCase, findCase, updateCase } from "@/lib/store";
import { getSessionUser } from "@/lib/session";

type Context = { params: Promise<{ caseId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { caseId } = await context.params;
  const record = await findCase(user.id, caseId);
  if (!record) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  return NextResponse.json({ case: record });
}

export async function PATCH(request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = casePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { caseId } = await context.params;
  const existing = await findCase(user.id, caseId);
  if (!existing) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const sending = parsed.data.sending_state ?? existing.sending_state;
  const receiving = parsed.data.receiving_state ?? existing.receiving_state;
  if (sending === receiving) {
    return NextResponse.json(
      {
        errors: {
          receiving_state:
            "Sending and receiving states must differ — ICPC is interstate.",
        },
      },
      { status: 422 },
    );
  }

  const record = await updateCase(user.id, caseId, parsed.data);
  return NextResponse.json({ case: record });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { caseId } = await context.params;
  const removed = await deleteCase(user.id, caseId);
  if (!removed) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
