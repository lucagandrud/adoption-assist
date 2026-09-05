"use client";

import { useMemo, useState } from "react";
import { WorkflowGraph } from "@/components/workflow/workflow-graph";
import { NodePanel } from "@/components/workflow/node-panel";
import { NODE_STATE_ORDER, NODE_STATE_STYLE } from "@/lib/node-state";
import { jurisdictionName } from "@/lib/states";
import type { GraphModel, NodeState } from "@/lib/types";

export function WorkflowDashboard({ model }: { model: GraphModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      model.nodes.find((node) => node.requirement_id === selectedId) ?? null,
    [model.nodes, selectedId],
  );

  const counts = useMemo(() => {
    const tally = {} as Record<NodeState, number>;
    for (const state of NODE_STATE_ORDER) tally[state] = 0;
    for (const node of model.nodes) tally[node.state] += 1;
    return tally;
  }, [model.nodes]);

  const defectCount = model.nodes.reduce(
    (total, node) => total + node.defects.length,
    0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SummaryStrip
        model={model}
        counts={counts}
        defectCount={defectCount}
        onSelectFirstDefect={() => {
          const first = model.nodes.find((node) => node.defects.length > 0);
          if (first) setSelectedId(first.requirement_id);
        }}
      />

      {model.source === "fixture" ? <FixtureBanner /> : null}

      <div className="relative min-h-[420px] flex-1">
        <WorkflowGraph
          model={model}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <Legend />
      </div>

      <NodePanel requirement={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function SummaryStrip({
  model,
  counts,
  defectCount,
  onSelectFirstDefect,
}: {
  model: GraphModel;
  counts: Record<NodeState, number>;
  defectCount: number;
  onSelectFirstDefect: () => void;
}) {
  return (
    <div className="border-b border-navy-800/12 bg-navy-800 text-beige-100">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-10 gap-y-3 px-6 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-beige-300">
            Placement
          </p>
          <p className="mt-1 text-lg text-beige-50">{model.case.label}</p>
          <p className="text-xs text-beige-300">
            {jurisdictionName(model.case.sending_state)} →{" "}
            {jurisdictionName(model.case.receiving_state)} ·{" "}
            {model.case.profile.children_count} child
            {model.case.profile.children_count === 1 ? "" : "ren"} ·{" "}
            {model.case.profile.relationship.replace(/_/g, " ")}
          </p>
        </div>

        <HeroStat
          label="Earliest filing date"
          value={model.earliest_filing}
          note="Critical path over external turnaround times"
        />
        <HeroStat
          label="Decision due"
          value={model.case.projected_decision}
          note="180-day window from receipt"
        />

        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-beige-300">
            Packet status
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {NODE_STATE_ORDER.map((state) => (
              <span
                key={state}
                className="inline-flex items-center gap-1.5 rounded-full border border-beige-100/20 bg-navy-900/40 px-2.5 py-1 text-xs"
              >
                <span
                  className={`size-1.5 rounded-full ${NODE_STATE_STYLE[state].dot}`}
                />
                {NODE_STATE_STYLE[state].label}
                <span className="font-mono font-semibold">{counts[state]}</span>
              </span>
            ))}
          </div>
        </div>

        {defectCount > 0 ? (
          <button
            type="button"
            onClick={onSelectFirstDefect}
            className="ml-auto rounded-md border border-state-defect bg-state-defect px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Review {defectCount} defect{defectCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-beige-300">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold text-gold">{value}</p>
      <p className="text-[11px] text-beige-300">{note}</p>
    </div>
  );
}

/**
 * Says plainly that the workflow on screen is the placeholder contract file.
 * Presenting placeholder structure as regulation would be the single most
 * damaging thing this UI could do (CLAUDE.md, hard boundary #4).
 */
function FixtureBanner() {
  return (
    <p className="border-b border-gold/40 bg-gold-soft px-6 py-2 text-xs leading-relaxed text-navy-800">
      <span className="font-semibold">Placeholder workflow.</span> These
      requirements, citations, and dates come from{" "}
      <code>demo/fixtures/graph-model.example.json</code> — the frontend/backend
      contract file — not from encoded regulation. Every node is marked
      unverified on purpose. Real requirement data arrives when{" "}
      <code>/engines/graph.ts</code> composes the state pair.
    </p>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-navy-800/15 bg-card/95 px-3.5 py-3 shadow-sm backdrop-blur">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-800">
        Node states
      </p>
      <ul className="space-y-1.5">
        {NODE_STATE_ORDER.map((state) => (
          <li key={state} className="flex items-center gap-2 text-xs">
            <span
              className={`size-2 rounded-full ${NODE_STATE_STYLE[state].dot}`}
            />
            <span className="text-navy-900">
              {NODE_STATE_STYLE[state].label}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2 border-t border-navy-800/10 pt-1.5 text-xs">
          <span className="h-0.5 w-4 rounded bg-gold" />
          <span className="text-navy-900">Critical path</span>
        </li>
      </ul>
    </div>
  );
}
