/**
 * The interview state machine (CLAUDE.md §4a.1).
 *
 * THIS FILE OWNS SEQUENCING. The model never chooses the next question. It
 * may ask for a clarification; whether one is actually asked is decided here,
 * from the block's authored `followup_policy`, and the machine advances
 * regardless once that allowance is spent.
 *
 * A pure function of (script, state, event) → state. No I/O, no LLM calls, no
 * imports from the API layer, no Date.now(). It runs identically on the
 * client (driving the room) and on the server (capping /respond), and it is
 * unit-testable with plain object literals.
 *
 * Phases:
 *
 *   ask          the block's authored prompt is due to be delivered
 *   listen       the prompt has been delivered; waiting on the subject
 *   clarify      a bounded follow-up is due to be delivered
 *   complete     every block has been asked
 */

import type { InterviewBlock, InterviewScript, InterviewTurn } from "@/lib/types";

export type MachinePhase = "ask" | "listen" | "clarify" | "complete";

export interface MachineState {
  phase: MachinePhase;
  /** Index into script.blocks. Equals blocks.length when complete. */
  blockIndex: number;
  /** Clarifications already asked on the current block. */
  clarificationsUsed: number;
  /**
   * The text the agent should deliver next. The block's prompt in `ask`, the
   * clarifying question in `clarify`, null otherwise. Always authored or
   * bounded — never a question the model chose to introduce.
   */
  pendingPrompt: string | null;
}

export type MachineEvent =
  /** The pending prompt (question or clarification) has been delivered. */
  | { type: "PROMPT_DELIVERED" }
  /**
   * The subject answered. `needsClarification` and `clarifyingQuestion` are
   * the model's *request*; this machine decides whether to honour it.
   */
  | {
      type: "ANSWERED";
      needsClarification: boolean;
      clarifyingQuestion: string | null;
    }
  /** Move on no matter what — used when extraction is unavailable. */
  | { type: "ADVANCE" };

/**
 * Authored fallback for when the model asks to clarify but returns no
 * question text. A fixed string, not a generated one, so it is the same for
 * every subject.
 */
export const FALLBACK_CLARIFICATION =
  "I didn't catch all of that. Could you say it again?";

/** How many clarifications a policy allows on one block. */
export function clarificationLimit(block: InterviewBlock): number {
  return block.followup_policy === "clarify_once" ? 1 : 0;
}

export function initialState(script: InterviewScript): MachineState {
  return script.blocks.length === 0
    ? { phase: "complete", blockIndex: 0, clarificationsUsed: 0, pendingPrompt: null }
    : {
        phase: "ask",
        blockIndex: 0,
        clarificationsUsed: 0,
        pendingPrompt: script.blocks[0].prompt,
      };
}

export function currentBlock(
  script: InterviewScript,
  state: MachineState,
): InterviewBlock | null {
  return script.blocks[state.blockIndex] ?? null;
}

export function isComplete(state: MachineState): boolean {
  return state.phase === "complete";
}

/** 0..1 for the progress bar; counts blocks fully asked. */
export function progress(script: InterviewScript, state: MachineState): number {
  if (script.blocks.length === 0) return 1;
  return Math.min(1, state.blockIndex / script.blocks.length);
}

function advance(script: InterviewScript, state: MachineState): MachineState {
  const next = state.blockIndex + 1;
  if (next >= script.blocks.length) {
    return {
      phase: "complete",
      blockIndex: script.blocks.length,
      clarificationsUsed: 0,
      pendingPrompt: null,
    };
  }
  return {
    phase: "ask",
    blockIndex: next,
    clarificationsUsed: 0,
    pendingPrompt: script.blocks[next].prompt,
  };
}

/**
 * The transition function. Unknown (phase, event) pairs return the state
 * unchanged rather than throwing, so a stray event from a slow network reply
 * can never wedge the room.
 */
export function transition(
  script: InterviewScript,
  state: MachineState,
  event: MachineEvent,
): MachineState {
  if (state.phase === "complete") return state;
  const block = script.blocks[state.blockIndex];
  if (!block) {
    return { ...state, phase: "complete", pendingPrompt: null };
  }

  switch (event.type) {
    case "PROMPT_DELIVERED":
      if (state.phase === "ask" || state.phase === "clarify") {
        return { ...state, phase: "listen", pendingPrompt: null };
      }
      return state;

    case "ANSWERED": {
      if (state.phase !== "listen") return state;
      const allowed = clarificationLimit(block);
      if (event.needsClarification && state.clarificationsUsed < allowed) {
        return {
          phase: "clarify",
          blockIndex: state.blockIndex,
          clarificationsUsed: state.clarificationsUsed + 1,
          pendingPrompt: event.clarifyingQuestion?.trim() || FALLBACK_CLARIFICATION,
        };
      }
      // Either no clarification was requested or the allowance is spent.
      // Advance regardless: a model that loops on a question is a stuck demo.
      return advance(script, state);
    }

    case "ADVANCE":
      return advance(script, state);
  }
}

/**
 * Server-side cap for /respond. Given the block and how many clarifications
 * have already been asked, says whether one more may be asked. The route
 * applies this to the model's reply before returning it, so a client cannot
 * be talked into a loop by a model that keeps asking.
 */
export function mayClarify(block: InterviewBlock, clarificationsUsed: number): boolean {
  return clarificationsUsed < clarificationLimit(block);
}

/**
 * Rebuilds the state from a persisted transcript so an interrupted session
 * resumes at the right question rather than restarting.
 *
 * Only agent turns whose text is exactly a block prompt mark progress; a
 * clarification does not. The last such prompt tells us the furthest block
 * reached; whether a subject turn follows it tells us whether it was
 * answered. Clarification counts are not recoverable from the transcript and
 * reset to zero, which errs toward asking one more bounded follow-up rather
 * than skipping one.
 */
export function resumeState(
  script: InterviewScript,
  turns: InterviewTurn[],
): MachineState {
  if (turns.length === 0) return initialState(script);

  const promptIndex = new Map<string, number>();
  script.blocks.forEach((block, i) => promptIndex.set(block.prompt, i));

  let furthest = -1;
  let furthestTurn = -1;
  for (const turn of turns) {
    if (turn.speaker !== "agent") continue;
    const index = promptIndex.get(turn.text);
    if (index !== undefined && index >= furthest) {
      furthest = index;
      furthestTurn = turn.turn_index;
    }
  }

  if (furthest === -1) return initialState(script);

  const answered = turns.some(
    (t) => t.speaker === "subject" && t.turn_index > furthestTurn,
  );

  const base: MachineState = {
    phase: "listen",
    blockIndex: furthest,
    clarificationsUsed: 0,
    pendingPrompt: null,
  };
  if (!answered) {
    // Prompt was delivered but never answered: ask it again on resume so the
    // subject hears the question rather than facing a silent microphone.
    return { ...base, phase: "ask", pendingPrompt: script.blocks[furthest].prompt };
  }
  return advance(script, base);
}

/** Next transcript index after the persisted turns. */
export function nextTurnIndex(turns: InterviewTurn[]): number {
  return turns.reduce((max, t) => Math.max(max, t.turn_index + 1), 0);
}
