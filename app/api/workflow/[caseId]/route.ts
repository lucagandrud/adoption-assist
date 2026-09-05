/**
 * Workflow graph for one case.
 *
 * The model itself is built in lib/workflow-model.ts — that module is the
 * single swap point for /engines/graph.ts, and the workflow page calls it
 * directly rather than round-tripping through HTTP. This route exists so the
 * contract is also reachable over the wire (curl it while debugging, and it
 * is what a second client would consume).
 */

import { NextResponse } from "next/server";
import { loadGraphModel } from "@/lib/workflow-model";
import { getSessionUser } from "@/lib/session";

type Context = { params: Promise<{ caseId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { caseId } = await context.params;
  const model = await loadGraphModel(user.id, caseId);
  if (!model) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  return NextResponse.json(model);
}
