/**
 * Zod schemas for the intake interview objects (CLAUDE.md §4a).
 *
 * Each schema is pinned to its hand-written type in lib/types.ts with
 * `satisfies z.ZodType<T>`, so adding or renaming a field on one side without
 * the other is a compile error rather than a runtime surprise.
 *
 * Used at three boundaries:
 *   - the script JSON in extraction/interviews/ is validated on import
 *   - every request body on /api/interview/[token]/* is parsed here
 *   - the model's reply on /respond is parsed here, and a reply that fails is
 *     treated as "no facts extracted" — never as a crash
 */

import { z } from "zod";
import type {
  ExtractedInterviewFact,
  InterviewBlock,
  InterviewResponse,
  InterviewScript,
  InterviewSessionStatus,
  InterviewTurn,
} from "@/lib/types";

const citationSchema = z.object({
  text: z.string(),
  url: z.string().nullable(),
  retrieved: z.string().nullable(),
});

export const interviewBlockSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  target_facts: z.array(z.string().min(1)).min(1),
  required: z.boolean(),
  followup_policy: z.enum(["clarify_once", "none"]),
  citation: citationSchema,
  verified: z.boolean(),
}) satisfies z.ZodType<InterviewBlock>;

export const interviewScriptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  applies_to: z.string().min(1),
  blocks: z.array(interviewBlockSchema).min(1),
}) satisfies z.ZodType<InterviewScript>;

export const interviewSessionStatusSchema = z.enum([
  "pending",
  "in_progress",
  "complete",
  "reviewed",
]) satisfies z.ZodType<InterviewSessionStatus>;

export const interviewTurnSchema = z.object({
  turn_index: z.number().int().min(0),
  speaker: z.enum(["agent", "subject"]),
  text: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
}) satisfies z.ZodType<InterviewTurn>;

export const extractedInterviewFactSchema = z.object({
  fact_id: z.string().min(1),
  value: z.string(),
  verbatim: z.string(),
}) satisfies z.ZodType<ExtractedInterviewFact>;

/**
 * The model's reply. `.strict()` is load-bearing: a reply carrying any extra
 * key — a "confidence", a "tone", a "note" — fails to parse and is discarded.
 * The response type has no field capable of carrying an assessment of the
 * subject (CLAUDE.md §4a.2), and this is where that is enforced at runtime.
 */
export const interviewResponseSchema = z
  .object({
    facts: z.array(extractedInterviewFactSchema),
    needs_clarification: z.boolean(),
    clarifying_question: z.string().nullable(),
    acknowledgment: z.string(),
  })
  .strict() satisfies z.ZodType<InterviewResponse>;

/* ------------------------------- request bodies --------------------------- */

export const turnRequestSchema = z.object({
  turn_index: z.number().int().min(0),
  speaker: z.enum(["agent", "subject"]),
  text: z.string(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
});

export const respondRequestSchema = z.object({
  block_id: z.string().min(1),
  utterance: z.string(),
  /** Index of the subject turn that produced `utterance`, for provenance. */
  turn_index: z.number().int().min(0),
  /** Clarifications already asked on this block. Server re-caps regardless. */
  clarifications_used: z.number().int().min(0),
});

export const createSessionSchema = z.object({
  subject_name: z.string().trim().min(1, "Enter the household member's name."),
  subject_role: z.string().trim().min(1, "Enter their role in the household."),
  script_id: z.string().min(1),
});

export const acceptFactSchema = z.object({
  /** An edited value, if the caseworker corrected it before accepting. */
  value: z.string().optional(),
});
