/** Case list and case creation for the signed-in caseworker. */

import { NextResponse } from "next/server";
import { caseSchema, fieldErrors } from "@/lib/validation";
import { createCase, listCases } from "@/lib/store";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({ cases: await listCases(user.id) });
}

export async function POST(request: Request) {
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

  const parsed = caseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const record = await createCase(user.id, parsed.data);
  return NextResponse.json({ case: record }, { status: 201 });
}
