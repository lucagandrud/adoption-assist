/**
 * THE SWAP POINT (handoff-frontend.md, Step 6).
 *
 * Today this returns demo/fixtures/graph-model.example.json — the contract
 * file — with the real case's identity stamped onto it, tagged
 * `source: "fixture"` so the dashboard can say out loud that the workflow is
 * placeholder structure and not regulation-derived output.
 *
 * When /engines/graph.ts emits valid contract JSON, the body below becomes:
 *
 *   import { buildGraphModel } from "@/engines/graph";
 *   const model = buildGraphModel({
 *     sending_state: record.sending_state,
 *     receiving_state: record.receiving_state,
 *     profile: { ... },
 *     window_start: record.window_start,
 *   });
 *   return { ...model, source: "engine" };
 *
 * Nothing in /app or /components changes. That is the point of the contract.
 */

import fixture from "@/demo/fixtures/graph-model.example.json";
import { findCase } from "@/lib/store";
import { directionOf } from "@/lib/states";
import type { CaseRecord, Direction, GraphModel } from "@/lib/types";

const base = fixture as unknown as GraphModel;

export function graphModelForCase(record: CaseRecord): GraphModel {
  return {
    ...base,
    source: "fixture",
    case: {
      id: record.id,
      label: record.label,
      sending_state: record.sending_state,
      receiving_state: record.receiving_state,
      direction: directionOf(
        record.sending_state,
        record.receiving_state,
      ) as Direction,
      profile: {
        relationship: record.relationship,
        children_count: record.children_count,
        placement_type: record.placement_type,
      },
      window_start: record.window_start,
      // Dates below stay as authored in the fixture. Deriving them is
      // /engines/validity.ts work — no date math in the UI layer.
      projected_decision: base.case.projected_decision,
    },
  };
}

export async function loadGraphModel(
  userId: string,
  caseId: string,
): Promise<GraphModel | null> {
  const record = await findCase(userId, caseId);
  return record ? graphModelForCase(record) : null;
}
