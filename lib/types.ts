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

/* ========================================================================== */
/*  Intake interview (CLAUDE.md §4a)                                          */
/*  Zod schemas for these live in lib/interview-schemas.ts and are pinned to  */
/*  these types with `satisfies`, so the two cannot drift.                    */
/* ========================================================================== */

/**
 * Where a fact came from. A discriminated union on `source` so a consumer
 * can never read a page number off an interview fact or a turn index off a
 * document fact. Interview facts and document facts are the SAME Fact object
 * downstream; only this provenance differs.
 */
export type FactProvenance =
  | {
      source: "document";
      document_id: string;
      document_name: string;
      page: number | null;
      field: string;
    }
  | {
      source: "interview";
      session_id: string;
      block_id: string;
      turn_index: number;
      /** The exact words that produced the value. */
      verbatim: string;
    };

/** How many times the agent may ask a bounded clarifying question per block. */
export type FollowupPolicy = "clarify_once" | "none";

/**
 * One authored question. `prompt` is read to every subject in these exact
 * words — the script is data, never generated (CLAUDE.md §4a.1).
 */
export interface InterviewBlock {
  id: string;
  prompt: string;
  /** Fact ids this question is allowed to populate. Anything else is dropped. */
  target_facts: string[];
  required: boolean;
  followup_policy: FollowupPolicy;
  /** Which requirement mandates this question. PLACEHOLDER until sourced. */
  citation: Citation;
  /** false => the citation is not sourced; the UI must say so. */
  verified: boolean;
}

export interface InterviewScript {
  id: string;
  label: string;
  /** Who this script is for, e.g. "household_adult". */
  applies_to: string;
  blocks: InterviewBlock[];
}

export type InterviewSessionStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "reviewed";

/**
 * One dispatched interview. Turns are NOT embedded here — they are a separate
 * table (supabase/migrations/0002_interviews.sql) and load separately, so a
 * session list never drags every transcript along with it.
 */
export interface InterviewSession {
  id: string;
  case_id: string;
  subject_name: string;
  subject_role: string;
  script_id: string;
  status: InterviewSessionStatus;
  /** Present only on the caseworker side. Never sent to the subject's page. */
  link_token: string | null;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

/** What the subject's page may know about its own session. No token, no case. */
export interface InterviewSessionPublic {
  id: string;
  subject_name: string;
  subject_role: string;
  script_id: string;
  status: InterviewSessionStatus;
  expires_at: string;
  completed_at: string | null;
}

export interface InterviewTurn {
  turn_index: number;
  speaker: "agent" | "subject";
  text: string;
  started_at: string;
  ended_at: string;
}

/**
 * A draft fact extracted from one utterance. `accepted` is false until a
 * caseworker accepts it; nothing downstream reads an unaccepted fact.
 */
export interface InterviewFact {
  id: string;
  session_id: string;
  fact_id: string;
  value: string;
  verbatim: string;
  block_id: string;
  turn_index: number;
  accepted: boolean;
  accepted_at: string | null;
  accepted_by: string | null;
}

/** One fact as the model returns it, before provenance is attached. */
export interface ExtractedInterviewFact {
  fact_id: string;
  value: string;
  verbatim: string;
}

/**
 * The strict contract for POST /api/interview/[token]/respond.
 *
 * This type intentionally has no field that can carry a score, rating,
 * assessment, sentiment, or characterization of the subject. That absence is
 * a product requirement (CLAUDE.md 4a.2), not an oversight. Do not add one.
 *
 * `needs_clarification` is a request, not a decision: lib/interview-machine.ts
 * decides whether a clarification is actually asked, per the block's
 * followup_policy. The model never chooses the next question.
 */
export interface InterviewResponse {
  facts: ExtractedInterviewFact[];
  needs_clarification: boolean;
  clarifying_question: string | null;
  acknowledgment: string;
}
