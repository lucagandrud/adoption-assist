"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Network } from "lucide-react";
import { WorkflowGraph } from "@/components/workflow/workflow-graph";
import { NodePanel } from "@/components/workflow/node-panel";
import {
  WorkflowOverview,
  countByState,
  countUniqueIssues,
} from "@/components/workflow/workflow-overview";
import { NODE_STATE_ORDER, NODE_STATE_STYLE } from "@/lib/node-state";
import { jurisdictionName } from "@/lib/states";
import type { GraphModel } from "@/lib/types";

export function WorkflowDashboard({ model }: { model: GraphModel }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "map">("overview");
  const [pending, setPending] = useState<"load" | "reset" | "resolve" | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const selected = useMemo(
    () => model.nodes.find((node) => node.requirement_id === selectedId) ?? null,
    [model.nodes, selectedId],
  );
  const counts = useMemo(() => countByState(model.nodes), [model.nodes]);
  const issueCount = useMemo(() => countUniqueIssues(model.nodes), [model.nodes]);

  async function updateDemo(method: "PUT" | "DELETE") {
    setPending(method === "PUT" ? "load" : "reset");
    setDemoError(null);
    try {
      const response = await fetch(`/api/cases/${model.case.id}/documents`, { method });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setDemoError(body.error ?? "Unable to update the demo packet.");
        return;
      }
      if (method === "DELETE") setSelectedId(null);
      router.refresh();
    } catch {
      setDemoError("Unable to reach the verification service.");
    } finally {
      setPending(null);
    }
  }

  async function resolveDemoIssue() {
    setPending("resolve");
    setDemoError(null);
    try {
      const response = await fetch(`/api/cases/${model.case.id}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document_id: "doc-home-health-safety-assessment-report",
          file_name: "home-safety-assessment-corrected.pdf",
          mime_type: "application/pdf",
          size: 2761,
          issue_date: "2026-09-14",
          variant: "consistent",
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setDemoError(body.error ?? "Unable to replace the demo document.");
        return;
      }
      router.refresh();
    } catch {
      setDemoError("Unable to reach the verification service.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SummaryStrip
        model={model}
        counts={counts}
        issueCount={issueCount}
        pending={pending}
        demoError={demoError}
        onLoad={() => updateDemo("PUT")}
        onReset={() => updateDemo("DELETE")}
      />

      {model.source === "fixture" ? <FixtureBanner /> : null}

      <nav className="border-b border-navy-800/10 bg-card" aria-label="Case views">
        <div className="mx-auto flex max-w-[1500px] items-center gap-1 px-5">
          <ViewButton active={view === "overview"} onClick={() => setView("overview")}>
            <ListChecks className="size-4" /> Case overview
          </ViewButton>
          <ViewButton active={view === "map"} onClick={() => setView("map")}>
            <Network className="size-4" /> Full workflow map
          </ViewButton>
        </div>
      </nav>

      {view === "overview" ? (
        <WorkflowOverview
          model={model}
          onSelect={setSelectedId}
          onResolveDemo={resolveDemoIssue}
          resolving={pending === "resolve"}
        />
      ) : (
        <div className="relative min-h-[520px] flex-1">
          <WorkflowGraph model={model} selectedId={selectedId} onSelect={setSelectedId} />
          <Legend />
        </div>
      )}

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
  issueCount,
  pending,
  demoError,
  onLoad,
  onReset,
}: {
  model: GraphModel;
  counts: ReturnType<typeof countByState>;
  issueCount: number;
  pending: "load" | "reset" | "resolve" | null;
  demoError: string | null;
  onLoad: () => void;
  onReset: () => void;
}) {
  const documentCount = model.evidence?.documents.length ?? 0;
  const verifiedCount = counts.verified;

  return (
    <section className="border-b border-navy-800/12 bg-navy-800 text-beige-100">
      <div className="mx-auto max-w-[1500px] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-md">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold">Active placement</p>
            <h1 className="mt-1 text-2xl text-beige-50">{model.case.label}</h1>
            <p className="mt-1 text-sm text-beige-300">
              {jurisdictionName(model.case.sending_state)} → {jurisdictionName(model.case.receiving_state)} · {model.case.profile.children_count} child{model.case.profile.children_count === 1 ? "" : "ren"} · {model.case.profile.relationship.replace(/_/g, " ")}
            </p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Files analyzed" value={String(documentCount)} />
            <Metric label="Requirements complete" value={`${verifiedCount}/${model.nodes.length}`} />
            <Metric label="Issues to resolve" value={String(issueCount + (model.validity?.at_risk_count ?? 0))} alert={issueCount > 0} />
            <Metric label="Decision due" value={model.case.projected_decision} mono />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onLoad} disabled={pending !== null} className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50">
              {pending === "load" ? "Preparing packet…" : documentCount ? "Replay guided demo" : "Start guided demo"}
            </button>
            {documentCount ? (
              <button type="button" onClick={onReset} disabled={pending !== null} className="rounded-md border border-beige-100/30 px-3 py-2.5 text-xs text-beige-100 hover:bg-white/10 disabled:opacity-50">
                {pending === "reset" ? "Resetting…" : "Reset packet"}
              </button>
            ) : null}
          </div>
        </div>
        {demoError ? <p className="mt-3 text-right text-xs text-red-200" role="alert">{demoError}</p> : null}
      </div>
    </section>
  );
}

function Metric({ label, value, mono = false, alert = false }: { label: string; value: string; mono?: boolean; alert?: boolean }) {
  return (
    <div className="border-l border-beige-100/15 pl-4">
      <p className="text-[10px] uppercase tracking-[0.15em] text-beige-300">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${mono ? "font-mono" : ""} ${alert ? "text-red-300" : "text-beige-50"}`}>{value}</p>
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${active ? "border-gold text-navy-900" : "border-transparent text-muted-foreground hover:text-navy-800"}`}>
      {children}
    </button>
  );
}

function FixtureBanner() {
  return (
    <p className="border-b border-gold/40 bg-gold-soft px-6 py-2 text-xs leading-relaxed text-navy-800">
      <span className="font-semibold">Illustrative workflow.</span> Requirements and dates are unverified demo research, not legal guidance.
    </p>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-navy-800/15 bg-card/95 px-3.5 py-3 shadow-sm backdrop-blur">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-800">Requirement states</p>
      <ul className="space-y-1.5">
        {NODE_STATE_ORDER.map((state) => (
          <li key={state} className="flex items-center gap-2 text-xs">
            <span className={`size-2 rounded-full ${NODE_STATE_STYLE[state].dot}`} />
            <span className="text-navy-900">{NODE_STATE_STYLE[state].label}</span>
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
