/**
 * THE SWAP POINT (handoff-frontend.md, Step 6).
 *
 * Today this returns demo/fixtures/graph-model.example.json — the contract
 * file — with the real case's identity stamped onto it, tagged
 * `source: "fixture"` so the dashboard can say out loud that the workflow is
 * placeholder structure and not regulation-derived output.
 *
 * When /engines/graph.ts emits valid contract JSON, graphModelForCase becomes:
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
 *
 * ONE ADDITION ON TOP OF THE FIXTURE: `overlayCaseFacts` flips `satisfied`
 * on `inputs[]` entries of kind "fact" that an ACCEPTED interview fact
 * covers, and attaches defects from the stand-in comparator in
 * lib/interview-consistency.ts. When /engines/consistency.ts lands, the
 * comparator call below is replaced and the overlay's job shrinks to the
 * satisfied flags — or disappears, if the engine reads the fact store itself.
 */

import fixture from "@/demo/fixtures/graph-model.example.json";
import { findCase } from "@/lib/store";
import { directionOf } from "@/lib/states";
import { readCaseFacts, type CaseFact } from "@/lib/fact-store";
import { checkInterviewConsistency } from "@/lib/interview-consistency";
import type {
  CaseRecord,
  Defect,
  Direction,
  GraphModel,
  GraphNode,
  NodeState,
} from "@/lib/types";

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

/**
 * Which node a defect belongs on: any node whose inputs name one of the
 * facts involved, or the document one of the sources came from. That puts an
 * interview-vs-tax-return contradiction on both the interview node and the
 * financial node, so neither side looks clean.
 */
function attachDefects(node: GraphNode, defects: Defect[]): Defect[] {
  const inputIds = new Set(node.inputs.map((i) => i.id));
  const known = new Set(node.defects.map((d) => d.rule_id));
  return defects.filter(
    (d) =>
      !known.has(d.rule_id) &&
      d.conflicting.some((c) => inputIds.has(c.fact_id) || inputIds.has(c.document_id)),
  );
}

/**
 * Only nodes the overlay actually touched get their state recomputed, and a
 * locked node stays locked unless it has a defect: upstream gating is the
 * engine's decision, not this file's. `defect` beats everything.
 */
function recomputeState(node: GraphNode, touched: boolean): NodeState {
  if (node.defects.length > 0) return "defect";
  if (!touched || node.state === "locked") return node.state;
  const satisfied = node.inputs.filter((i) => i.satisfied).length;
  if (node.inputs.length > 0 && satisfied === node.inputs.length) return "verified";
  if (satisfied > 0) return "in_progress";
  return node.state;
}

export function overlayCaseFacts(model: GraphModel, facts: CaseFact[]): GraphModel {
  const accepted = new Set(
    facts.filter((f) => f.provenance.source === "interview").map((f) => f.fact_id),
  );
  const defects = checkInterviewConsistency(facts);

  const nodes = model.nodes.map((node) => {
    let touched = false;
    const inputs = node.inputs.map((input) => {
      if (input.kind === "fact" && !input.satisfied && accepted.has(input.id)) {
        touched = true;
        return { ...input, satisfied: true };
      }
      return input;
    });
    const added = attachDefects(node, defects);
    if (!touched && added.length === 0) return node;

    const next: GraphNode = { ...node, inputs, defects: [...node.defects, ...added] };
    return { ...next, state: recomputeState(next, touched) };
  });

  return { ...model, nodes };
}

/** The fixture model with the case's accepted facts overlaid. */
export async function graphModelWithFacts(
  userId: string,
  record: CaseRecord,
): Promise<GraphModel> {
  const facts = await readCaseFacts(userId, record.id);
  return overlayCaseFacts(graphModelForCase(record), facts);
}

export async function loadGraphModel(
  userId: string,
  caseId: string,
): Promise<GraphModel | null> {
  const record = await findCase(userId, caseId);
  return record ? graphModelWithFacts(userId, record) : null;
}
