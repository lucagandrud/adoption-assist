"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowGraph } from "@/components/workflow/workflow-graph";
import { NodePanel } from "@/components/workflow/node-panel";
import { NODE_STATE_ORDER, NODE_STATE_STYLE } from "@/lib/node-state";
import { jurisdictionName } from "@/lib/states";
import type { GraphModel, NodeState } from "@/lib/types";

export function WorkflowDashboard({ model }: { model: GraphModel }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

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
        resetting={resetting}
        loadingDemo={loadingDemo}
        demoError={demoError}
        onLoadDemo={async () => {
          setLoadingDemo(true);
          setDemoError(null);
          try {
            const response = await fetch(`/api/cases/${model.case.id}/documents`, {
              method: "PUT",
            });
            if (!response.ok) {
              const body = (await response.json()) as { error?: string };
              setDemoError(body.error ?? "Unable to load the verification demo.");
              return;
            }
            router.refresh();
          } catch {
            setDemoError("Unable to reach the verification service.");
          } finally {
            setLoadingDemo(false);
          }
        }}
        onReset={async () => {
          setResetting(true);
          setDemoError(null);
          try {
            const response = await fetch(`/api/cases/${model.case.id}/documents`, {
              method: "DELETE",
            });
            if (!response.ok) {
              const body = (await response.json()) as { error?: string };
              setDemoError(body.error ?? "Unable to reset the demo documents.");
              return;
            }
            setSelectedId(null);
            router.refresh();
          } catch {
            setDemoError("Unable to reach the verification service.");
          } finally {
            setResetting(false);
          }
        }}
      />

      {model.source === "fixture" ? <FixtureBanner /> : null}
      {model.data_quality?.unknown_turnaround_count ? (
        <DataQualityBanner count={model.data_quality.unknown_turnaround_count} />
      ) : null}

      <div className="relative min-h-[420px] flex-1">
        <WorkflowGraph
          model={model}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <Legend />
      </div>

      <NodePanel
        requirement={selected}
        caseId={model.case.id}
        validity={model.validity?.items ?? []}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function SummaryStrip({
  model,
  counts,
  defectCount,
  onSelectFirstDefect,
  resetting,
  loadingDemo,
  demoError,
  onLoadDemo,
  onReset,
}: {
  model: GraphModel;
  counts: Record<NodeState, number>;
  defectCount: number;
  onSelectFirstDefect: () => void;
  resetting: boolean;
  loadingDemo: boolean;
  demoError: string | null;
  onLoadDemo: () => void;
  onReset: () => void;
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
        {model.delta ? (
          <HeroStat
            label="Receiving-only items"
            value={String(model.delta.surprise_count)}
            note={`${model.delta.inferred_match_count} inferred cross-state matches`}
          />
        ) : null}
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

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loadingDemo || resetting}
            className="rounded-md border border-gold bg-gold px-3 py-2 text-xs font-semibold text-navy-900 hover:brightness-110 disabled:opacity-50"
          >
            {loadingDemo ? "Loading demo…" : "Load verification demo"}
          </button>
          {model.validity?.at_risk_count ? (
            <span className="rounded-md border border-gold/60 bg-gold-soft px-3 py-2 text-xs font-semibold text-navy-900">
              {model.validity.at_risk_count} expiring document
              {model.validity.at_risk_count === 1 ? "" : "s"}
            </span>
          ) : null}
          {defectCount > 0 ? (
            <button
              type="button"
              onClick={onSelectFirstDefect}
              className="rounded-md border border-state-defect bg-state-defect px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Review {defectCount} defect{defectCount === 1 ? "" : "s"}
            </button>
          ) : null}
          {(model.validity?.items.length ?? 0) > 0 ? (
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="rounded-md border border-beige-100/30 px-3 py-2 text-xs text-beige-100 hover:bg-white/10 disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Reset demo documents"}
            </button>
          ) : null}
        </div>
        {demoError ? (
          <p className="basis-full text-right text-xs text-red-200" role="alert">
            {demoError}
          </p>
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

function DataQualityBanner({ count }: { count: number }) {
  return (
    <p className="border-b border-gold/40 bg-gold-soft px-6 py-2 text-xs leading-relaxed text-navy-800">
      <span className="font-semibold">Projection caveat.</span> {count} document
      definitions have no sourced turnaround time and contribute zero days to
      the estimate. Treat the filing date as incomplete until those values are
      verified.
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
