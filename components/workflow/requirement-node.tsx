"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NODE_STATE_STYLE } from "@/lib/node-state";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/graph-layout";
import type { GraphNode } from "@/lib/types";

export type RequirementNodeData = {
  requirement: GraphNode;
  isSelected: boolean;
};

export type RequirementNodeType = Node<RequirementNodeData, "requirement">;

export function RequirementNode({ data }: NodeProps<RequirementNodeType>) {
  const { requirement, isSelected } = data;
  const style = NODE_STATE_STYLE[requirement.state];

  const satisfied = requirement.inputs.filter((i) => i.satisfied).length;
  const total = requirement.inputs.length;
  const defects = requirement.defects.length;

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={[
        "flex cursor-pointer flex-col justify-between rounded-lg border px-3.5 py-3 text-left shadow-sm transition",
        style.card,
        isSelected ? "ring-2 ring-navy-700 ring-offset-2 ring-offset-transparent" : "",
        requirement.on_critical_path ? "border-l-4 border-l-gold" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-navy-900">
          {requirement.label}
        </p>
        {defects > 0 ? (
          <span className="shrink-0 rounded-full bg-state-defect px-2 py-0.5 text-[10px] font-bold text-white">
            {defects} defect{defects === 1 ? "" : "s"}
          </span>
        ) : requirement.state === "verified" ? (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full bg-state-verified text-[11px] font-bold text-white"
          >
            ✓
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.chip}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {satisfied}/{total} inputs
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
        {requirement.on_critical_path ? (
          <span className="font-semibold text-gold">Critical path</span>
        ) : (
          <span className="text-muted-foreground">
            {requirement.slack_days}d slack
          </span>
        )}
        {!requirement.verified ? (
          <span
            title="No sourced citation yet for this requirement."
            className="rounded border border-gold/50 bg-gold-soft px-1.5 py-px font-semibold text-navy-800"
          >
            Unverified
          </span>
        ) : null}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
