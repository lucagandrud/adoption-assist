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
  page_or_section?: string | null;
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
  validity?: ValidityReport;
  delta?: {
    surprise_count: number;
    total_items: number;
    inferred_match_count: number;
  };
  data_quality?: {
    unknown_turnaround_count: number;
    warnings: string[];
  };
}

export interface ValidityStatus {
  document_id: string;
  definition_id: string;
  document_name: string;
  issue_date: string | null;
  expires_on: string | null;
  days_remaining: number | null;
  state: "valid" | "at_risk" | "expired" | "unknown";
  renew_by: string | null;
  lapses_on_day: number | null;
  renewal_is_late: boolean;
}

export interface ValidityReport {
  window_start: string;
  window_end: string;
  projected_decision: string;
  items: ValidityStatus[];
  at_risk_count: number;
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
}

export interface StoredProvenance {
  source_kind: "document" | "manual";
  document_id?: string | null;
  document_name?: string | null;
  page?: number | null;
  field?: string | null;
  extracted_at: string;
}

export interface StoredFact {
  id: string;
  type: string;
  value: unknown;
  provenance: StoredProvenance[];
  confidence: number;
  extracted_at: string;
}

export interface CaseDocumentRecord {
  id: string;
  case_id: string;
  definition_id: string;
  file_name: string;
  mime_type: string;
  issue_date: string | null;
  extraction_mode: "synthetic_cache" | "live_anthropic";
  facts: StoredFact[];
  uploaded_at: string;
}
