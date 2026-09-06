/**
 * Types for the frontend/backend contract.
 *
 * SOURCE OF TRUTH: demo/fixtures/graph-model.example.json
 * These types are hand-written from that file. If the fixture shape changes,
 * change it here in the same commit — both sides break at once otherwise.
 * See docs/handoff-frontend.md, Step 0.
 */

export type NodeState =
  | "locked"
  | "available"
  | "in_progress"
  | "verified"
  | "defect";

export type Direction = `${string}_to_${string}`;

export interface Citation {
  text: string;
  url: string | null;
  retrieved: string | null;
}

export interface RequirementInput {
  kind: "document" | "fact";
  id: string;
  label: string;
  satisfied: boolean;
}

export interface ConflictingSource {
  fact_id: string;
  value: string;
  document_id: string;
  document_name: string;
  page: number | null;
  field: string;
}

export interface Defect {
  rule_id: string;
  severity: "blocking" | "warning" | string;
  message: string;
  citation: Citation;
  /** Always names BOTH sides of a contradiction. Never render only one. */
  conflicting: ConflictingSource[];
}

export interface GraphNode {
  requirement_id: string;
  label: string;
  state: NodeState;
  on_critical_path: boolean;
  slack_days: number;
  earliest_start: string;
  earliest_finish: string;
  citation: Citation;
  /** false => the requirement is not sourced yet; the UI must say so. */
  verified: boolean;
  inputs: RequirementInput[];
  defects: Defect[];
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface CaseProfile {
  relationship: string;
  children_count: number;
  placement_type: string;
}

export interface CaseSummary {
  id: string;
  label: string;
  sending_state: string;
  receiving_state: string;
  direction: Direction;
  profile: CaseProfile;
  window_start: string;
  projected_decision: string;
}

export interface GraphModel {
  case: CaseSummary;
  earliest_filing: string;
  critical_path: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  /**
   * Set by /api/workflow/[caseId]. "fixture" means the workflow shown is the
   * placeholder contract file, not regulation-derived output from /engines.
   * The UI must display this distinction — see hard boundary #4 in CLAUDE.md.
   */
  source?: "fixture" | "engine";
}

/** Persisted records (see lib/store.ts). */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  agency: string;
  created_at: string;
  last_seen_at: string;
}

export interface CaseRecord {
  /**
   * Human-readable docket number: ICPC-{year}-{4-digit sequence}, allocated
   * from a per-year counter in the store. A caseworker reads this aloud on the
   * phone and writes it on a folder, so it is sequential and pronounceable
   * rather than a random hex slug.
   */
  id: string;
  owner_user_id: string;
  label: string;
  sending_state: string;
  receiving_state: string;
  relationship: string;
  children_count: number;
  placement_type: string;
  window_start: string;
  created_at: string;
  updated_at: string;

  /**
   * PLACEHOLDER until /engines/graph.ts lands. Percentage of the case's
   * requirements that are verified. Once the engine emits a real GraphModel
   * this is derived from nodes[] rather than stored:
   *   verified nodes / total nodes
   * Drives tile size on the caseload grid — less complete means more work
   * remaining, so the tile is larger.
   */
  completion_pct: number;

  /** PLACEHOLDER. ISO date of the next thing that comes due on this case. */
  next_deadline: string;

  /** PLACEHOLDER. What is due on that date. */
  next_deadline_label: string;
}
