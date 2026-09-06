/**
 * Presentation vocabulary for the five node states.
 *
 * One table, used by the node, the legend, and the panel, so the same state
 * never renders two ways. `defect` outranks `verified` everywhere: a node with
 * every input present but a contradiction between them must never look done.
 */

import type { NodeState } from "@/lib/types";

export interface StateStyle {
  label: string;
  /** What this state means to a caseworker, in one line. */
  hint: string;
  chip: string;
  card: string;
  dot: string;
}

export const NODE_STATE_STYLE: Record<NodeState, StateStyle> = {
  locked: {
    label: "Locked",
    hint: "An upstream requirement is not finished yet.",
    chip: "bg-state-locked-bg text-state-locked border-state-locked/30",
    card: "border-state-locked/35 bg-state-locked-bg/70 opacity-75",
    dot: "bg-state-locked",
  },
  available: {
    label: "Ready to work",
    hint: "Dependencies are met. This one is actionable now.",
    chip: "bg-white text-navy-700 border-navy-700/30",
    card: "border-navy-700/35 bg-white",
    dot: "bg-navy-700",
  },
  in_progress: {
    label: "In progress",
    hint: "Some inputs are in, some are still outstanding.",
    chip: "bg-state-progress-bg text-state-progress border-state-progress/35",
    card: "border-state-progress/45 bg-state-progress-bg",
    dot: "bg-state-progress",
  },
  verified: {
    label: "Requirement complete",
    hint: "The required evidence is present and internally consistent.",
    chip: "bg-state-verified-bg text-state-verified border-state-verified/35",
    card: "border-state-verified/50 bg-state-verified-bg",
    dot: "bg-state-verified",
  },
  defect: {
    label: "Defect found",
    hint: "Documents contradict each other or a field is missing.",
    chip: "bg-state-defect-bg text-state-defect border-state-defect/35",
    card: "border-state-defect/55 bg-state-defect-bg",
    dot: "bg-state-defect",
  },
};

export const NODE_STATE_ORDER: NodeState[] = [
  "locked",
  "available",
  "in_progress",
  "verified",
  "defect",
];
