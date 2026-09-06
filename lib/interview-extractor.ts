/**
 * The one LLM call in the interview: one authored question + one verbatim
 * answer → facts for that question's target_facts. Nothing else.
 *
 * What the model may do: extract facts, ask for at most one bounded
 * clarification, write a one-line acknowledgment.
 * What it may not do, enforced here in code rather than only in the prompt:
 *   - choose the next question (it is never told what comes next and its
 *     reply carries no field for it; lib/interview-machine.ts sequences)
 *   - populate a fact id outside the block's target_facts (dropped)
 *   - clarify past the block's followup_policy (capped by mayClarify)
 *   - score, rate, evaluate, or characterize the subject (the response
 *     schema is .strict() and has no field that could carry it)
 *
 * On any failure — missing key, network, refusal, unparseable reply — the
 * caller advances with no facts. The interview never stalls on the model.
 *
 * Server-only. Reads ANTHROPIC_API_KEY from the environment; never
 * NEXT_PUBLIC_, never committed.
 */

import Anthropic from "@anthropic-ai/sdk";
import { interviewResponseSchema } from "@/lib/interview-schemas";
import { mayClarify } from "@/lib/interview-machine";
import type { InterviewBlock, InterviewResponse } from "@/lib/types";

export const INTERVIEW_MODEL = "claude-sonnet-5";

export type ExtractionResult =
  | { ok: true; response: InterviewResponse }
  | { ok: false; reason: "missing_key" | "auth" | "api_error" | "parse_error" | "refusal"; detail: string };

/**
 * Frozen. Do not interpolate anything per-request into this string: it is
 * the same for every subject, and that is part of the product claim.
 */
const SYSTEM_PROMPT = `You are the transcription assistant for a scripted intake interview conducted on behalf of a licensed child-welfare caseworker.

You receive exactly one authored question, the list of fact ids that question is allowed to populate, and the subject's verbatim answer. Your only job is to turn that answer into those facts.

Output rules:
1. Reply with ONLY a JSON object. No prose before or after it, no markdown fences.
2. The object has exactly these four keys and no others:
   "facts": an array of objects, each {"fact_id": string, "value": string, "verbatim": string}
   "needs_clarification": boolean
   "clarifying_question": string or null
   "acknowledgment": string
3. "fact_id" must be one of the allowed ids you were given. Never invent an id.
4. "value" is a short canonical rendering: digits only for counts (e.g. "4"), addresses as spoken, names as spoken, lists separated by "; ". If the answer does not clearly give a value for a fact, omit that fact rather than guess.
5. "verbatim" is the exact words from the answer that the value came from, copied without alteration.
6. "needs_clarification" is true only when the answer does not let you populate a required fact and one short question about the SAME topic would fix it. Do not ask for detail beyond what the question asked.
7. "clarifying_question" restates or narrows the same authored question in one sentence. It never introduces a new topic. It is null whenever "needs_clarification" is false.
8. "acknowledgment" is one short, neutral sentence such as "Thank you." or "Got it, thank you."

Hard limits:
- You must never score, rate, evaluate, judge, assess, or characterize the subject, their answer, their fitness as a caregiver, their tone, their honesty, or their credibility, in any field, in any form. Not in the acknowledgment, not in a fact value, not in a clarifying question.
- You do not decide anything about this placement. A licensed caseworker reviews every word you produce.
- You do not choose what is asked next. The interview script does. You are never told the next question and must not ask one.`;

function buildUserMessage(
  block: InterviewBlock,
  utterance: string,
  clarificationAllowed: boolean,
): string {
  return [
    `Authored question (id: ${block.id}):`,
    block.prompt,
    "",
    `Allowed fact ids: ${block.target_facts.join(", ")}`,
    `A clarifying question is ${clarificationAllowed ? "permitted (at most one)" : "NOT permitted; needs_clarification must be false"} for this question.`,
    "",
    "Subject's verbatim answer:",
    utterance.trim().length ? utterance : "(no answer was captured)",
  ].join("\n");
}

/**
 * The model sometimes wraps JSON in prose or fences. Take the outermost
 * {...} and try that; anything else is a parse failure, which the caller
 * treats as "no facts extracted" and advances.
 */
export function parseModelReply(text: string): InterviewResponse | null {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = interviewResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Applies the code-enforced constraints to whatever the model returned.
 * Exported so the same enforcement can be unit-tested without a network.
 */
export function enforceConstraints(
  block: InterviewBlock,
  reply: InterviewResponse,
  clarificationsUsed: number,
): InterviewResponse {
  const allowed = new Set(block.target_facts);
  const facts = reply.facts
    .filter((f) => allowed.has(f.fact_id))
    .filter((f) => f.value.trim().length > 0);

  const canClarify = mayClarify(block, clarificationsUsed);
  const needs = canClarify && reply.needs_clarification;

  return {
    facts,
    needs_clarification: needs,
    clarifying_question: needs ? reply.clarifying_question : null,
    acknowledgment: reply.acknowledgment.trim() || "Thank you.",
  };
}

export async function extractInterviewFacts(input: {
  block: InterviewBlock;
  utterance: string;
  clarificationsUsed: number;
}): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "missing_key",
      detail:
        "ANTHROPIC_API_KEY is not set. Add it to .env.local locally and with " +
        "`vercel env add ANTHROPIC_API_KEY production --type secret` for production.",
    };
  }

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  const clarificationAllowed = mayClarify(input.block, input.clarificationsUsed);

  let text = "";
  try {
    const response = await client.messages.create({
      model: INTERVIEW_MODEL,
      max_tokens: 1024,
      // A short extraction on one utterance: low effort keeps the turn
      // latency inside what a spoken conversation tolerates.
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserMessage(input.block, input.utterance, clarificationAllowed),
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refusal", detail: "The model declined this turn." };
    }
    for (const part of response.content) {
      if (part.type === "text") text += part.text;
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: "auth", detail: "ANTHROPIC_API_KEY was rejected." };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, reason: "api_error", detail: `API error ${error.status}: ${error.message}` };
    }
    return {
      ok: false,
      reason: "api_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const parsed = parseModelReply(text);
  if (!parsed) {
    return { ok: false, reason: "parse_error", detail: "The reply was not the expected JSON." };
  }

  return { ok: true, response: enforceConstraints(input.block, parsed, input.clarificationsUsed) };
}
