"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  FileText,
  Play,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NODE_STATE_STYLE } from "@/lib/node-state";
import type {
  Defect,
  EvidenceDocument,
  GraphModel,
  GraphNode,
  NodeState,
} from "@/lib/types";
import type {
  PreflightPending,
  PreflightRun,
} from "@/components/workflow/workflow-dashboard";

type UniqueIssue = {
  key: string;
  defect: Defect;
  requirements: GraphNode[];
};

function defectKey(defect: Defect) {
  return `${defect.rule_id}:${defect.conflicting
    .map(({ fact_id }) => fact_id)
    .sort()
    .join(":")}`;
}

function uniqueIssues(nodes: GraphNode[]): UniqueIssue[] {
  const byKey = new Map<string, UniqueIssue>();
  for (const node of nodes) {
    for (const defect of node.defects) {
      const key = defectKey(defect);
      const existing = byKey.get(key);
      if (existing) existing.requirements.push(node);
      else byKey.set(key, { key, defect, requirements: [node] });
    }
  }
  return [...byKey.values()];
}

const PHASES = [
  {
    label: "Authorization and intake",
    terms: ["court", "application", "definition", "eligibility", "family member"],
  },
  {
    label: "Packet preparation",
    terms: ["packet", "100a", "cover letter", "financial medical", "case history"],
  },
  {
    label: "Background checks",
    terms: [
      "background",
      "criminal",
      "clearance",
      "registry",
      "megans",
      "dmv",
      "laars",
      "lis",
      "caci",
    ],
  },
  {
    label: "Home assessment",
    terms: [
      "home",
      "bed",
      "pool",
      "fire",
      "smoke",
      "capacity",
      "interview",
      "psychosocial",
      "training",
      "health",
      "screening",
      "income",
      "waiver",
      "weapons",
    ],
  },
  {
    label: "Filing and decision",
    terms: [
      "approval",
      "decision",
      "submission",
      "forwarding",
      "tico",
      "100b",
      "post placement",
      "supervision",
      "deadline",
    ],
  },
] as const;

function phaseFor(node: GraphNode) {
  const searchable = `${node.requirement_id} ${node.label}`.toLowerCase();
  return (
    PHASES.find(({ terms }) => terms.some((term) => searchable.includes(term))) ??
    PHASES[1]
  ).label;
}

function issueTitle(ruleId: string) {
  const names: Record<string, string> = {
    "rule-address-consistency": "Residence addresses do not match",
    "rule-name-consistency": "Legal names do not match",
    "rule-household-size-consistency": "Household size needs review",
    "rule-bedroom-capacity": "Bedroom capacity needs review",
  };
  return names[ruleId] ?? "Document inconsistency needs review";
}

export function WorkflowOverview({
  model,
  onSelect,
  onResolveDemo,
  onRun,
  onReset,
  pending,
  error,
  lastRun,
}: {
  model: GraphModel;
  onSelect: (requirementId: string) => void;
  onResolveDemo?: () => void;
  onRun: (mode: "live" | "replay") => void;
  onReset: () => void;
  pending: PreflightPending;
  error: string | null;
  lastRun: PreflightRun | null;
}) {
  const issues = uniqueIssues(model.nodes);
  const expiring = model.validity?.items.filter(
    ({ state }) => state === "at_risk" || state === "expired",
  ) ?? [];
  const ready = model.nodes
    .filter(({ state }) => state === "available" || state === "in_progress")
    .slice(0, 6);
  const phaseRows = PHASES.map(({ label }) => {
    const nodes = model.nodes.filter((node) => phaseFor(node) === label);
    return {
      label,
      nodes,
      complete: nodes.filter(({ state }) => state === "verified").length,
      defects: nodes.filter(({ state }) => state === "defect").length,
    };
  }).filter(({ nodes }) => nodes.length > 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-beige-100">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <main className="space-y-5">
          <PreflightLauncher
            model={model}
            pending={pending}
            error={error}
            lastRun={lastRun}
            onRun={onRun}
            onReset={onReset}
          />
          <section className="rounded-xl border border-navy-800/12 bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-state-defect">
                  Preflight review
                </p>
                <h2 className="mt-1 text-2xl text-navy-900">Needs attention</h2>
              </div>
              <span className="rounded-full bg-state-defect-bg px-3 py-1 text-xs font-semibold text-state-defect">
                {issues.length + expiring.length} item
                {issues.length + expiring.length === 1 ? "" : "s"}
              </span>
            </div>

            {issues.length === 0 && expiring.length === 0 ? (
              <div className="flex items-start gap-3 px-5 py-6">
                <CheckCircle2 className="mt-0.5 size-5 text-state-verified" />
                <div>
                  <p className="font-semibold text-navy-900">No document issues detected</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add documents to begin preflight. A clear result means the paperwork is
                    internally consistent, not that the placement is approved.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-navy-800/10">
                {issues.map(({ key, defect, requirements }) => (
                  <div
                    key={key}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-state-defect-bg text-state-defect">
                      <AlertTriangle className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-semibold text-navy-900">
                        {issueTitle(defect.rule_id)}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                        {defect.message}
                      </span>
                      <span className="mt-2 block text-xs font-medium text-state-defect">
                        {defect.conflicting.length} sources compared · affects {requirements.length}{" "}
                        requirement{requirements.length === 1 ? "" : "s"}
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onSelect(requirements[0].requirement_id)} className="inline-flex items-center gap-1.5 rounded-md border border-navy-700/25 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-beige-100">
                          Review evidence <ArrowRight className="size-3" />
                        </button>
                        {defect.rule_id === "rule-address-consistency" && onResolveDemo ? (
                          <button type="button" onClick={onResolveDemo} disabled={pending !== null} className="rounded-md bg-state-defect px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
                            {pending === "resolve" ? "Rechecking…" : "Replace with corrected sample"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {expiring.map((item) => (
                  <div key={item.document_id} className="flex items-start gap-4 px-5 py-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft text-gold">
                      <Clock3 className="size-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-navy-900">
                        {item.document_name} {item.state === "expired" ? "has expired" : "may expire before decision"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Issued {item.issue_date ?? "on an unknown date"}
                        {item.expires_on ? ` · expires ${item.expires_on}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-navy-800/12 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-600">
                  Packet progress
                </p>
                <h2 className="mt-1 text-xl text-navy-900">Work organized by phase</h2>
              </div>
              <p className="text-xs text-muted-foreground">Requirements, not uploaded files</p>
            </div>
            <div className="space-y-3">
              {phaseRows.map(({ label, nodes, complete, defects }) => {
                const percent = Math.round((complete / nodes.length) * 100);
                return (
                  <div key={label} className="grid items-center gap-3 sm:grid-cols-[190px_1fr_110px]">
                    <p className="text-sm font-medium text-navy-900">{label}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-beige-200" aria-hidden>
                      <div
                        className={defects ? "h-full bg-state-defect" : "h-full bg-state-verified"}
                        style={{ width: `${Math.max(percent, defects ? 4 : 0)}%` }}
                      />
                    </div>
                    <p className="text-right font-mono text-xs text-muted-foreground">
                      {complete}/{nodes.length} complete
                      {defects ? ` · ${defects} flagged` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-navy-800/12 bg-card p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-600">
                Next actions
              </p>
              <h2 className="mt-1 text-xl text-navy-900">Ready for the caseworker</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {ready.map((node) => {
                const missing = node.inputs.filter(({ satisfied }) => !satisfied);
                return (
                  <button
                    key={node.requirement_id}
                    type="button"
                    onClick={() => onSelect(node.requirement_id)}
                    className="rounded-lg border border-navy-800/12 bg-beige-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-navy-700/35 hover:shadow-sm"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-navy-600">
                      {phaseFor(node)}
                    </span>
                    <span className="mt-1.5 block text-sm font-semibold text-navy-900">
                      {node.label}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {missing.length
                        ? `${missing.length} input${missing.length === 1 ? "" : "s"} outstanding`
                        : "Open for details"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <EvidencePanel documents={model.evidence?.documents ?? []} />
          <section className="rounded-xl border border-navy-800/12 bg-navy-800 p-5 text-beige-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              Trust architecture
            </p>
            <h2 className="mt-1 text-xl text-beige-50">AI reads. Rules decide. People approve.</h2>
            <ol className="mt-5 space-y-4">
              <TrustStep icon={Sparkles} number="1" title="Constrained extraction" text="AI returns only ontology-approved facts with page, field, and confidence." />
              <TrustStep icon={Scale} number="2" title="Deterministic checks" text="Versioned rules compare facts, calculate dates, and compose the state workflow." />
              <TrustStep icon={ShieldCheck} number="3" title="Human decision" text="Caseworkers resolve exceptions. The system never approves or ranks a family." />
            </ol>
          </section>

          <details className="rounded-xl border border-gold/35 bg-gold-soft p-4 text-sm text-navy-900">
            <summary className="cursor-pointer font-semibold">Research and projection status</summary>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-navy-800/80">
              <p>
                {model.research_status?.verified_requirements ?? 0} of{" "}
                {model.research_status?.total_requirements ?? model.nodes.length} applicable
                requirements have completed human source review.
              </p>
              <p>
                {model.data_quality?.unknown_turnaround_count ?? 0} document definitions lack a
                sourced turnaround. The statutory decision date is shown; inferred filing
                projections are not presented as complete.
              </p>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

function PreflightLauncher({
  model,
  pending,
  error,
  lastRun,
  onRun,
  onReset,
}: {
  model: GraphModel;
  pending: PreflightPending;
  error: string | null;
  lastRun: PreflightRun | null;
  onRun: (mode: "live" | "replay") => void;
  onReset: () => void;
}) {
  const files = model.evidence?.documents.length ?? 0;
  const liveAvailable = Boolean(
    model.extraction?.live_available && model.extraction.sample_live_supported,
  );
  const liveFiles = model.evidence?.live_count ?? 0;
  const mode = lastRun?.mode ?? (liveFiles > 0 ? "live_anthropic" : "synthetic_cache");
  const hasRun = files > 0;
  const tokenTotal =
    lastRun?.input_tokens != null && lastRun.output_tokens != null
      ? lastRun.input_tokens + lastRun.output_tokens
      : null;

  return (
    <section className="overflow-hidden rounded-xl border border-navy-800/15 bg-card shadow-sm">
      <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${hasRun ? "bg-state-verified-bg text-state-verified" : "bg-navy-800 text-beige-50"}`}>
              <span className={`size-1.5 rounded-full ${hasRun ? "bg-state-verified" : "bg-gold"}`} />
              {hasRun ? "Preflight complete" : "Sample packet"}
            </span>
            {hasRun ? (
              <span className="rounded-full border border-navy-800/15 px-2.5 py-1 text-[10px] font-semibold text-navy-700">
                {mode === "live_anthropic" ? `Live AI · ${lastRun?.model ?? model.extraction?.model}` : "Deterministic replay"}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-2xl text-navy-900">
            {hasRun ? "Review what the preflight found" : "Analyze a three-document sample packet"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {hasRun
              ? "The system extracted administrative facts, compared them across documents, and checked validity. Resolve the exceptions below before submission."
              : "Use the actual synthetic PDFs to see extraction, provenance, deterministic consistency checks, and expiration review in one pass."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRun("live")}
              disabled={!liveAvailable || pending !== null}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-beige-50 shadow-sm transition hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className="size-4 text-gold" />
              {pending === "live" ? "Reading the PDFs…" : hasRun ? "Run again with live AI" : "Analyze with live AI"}
            </button>
            <button
              type="button"
              onClick={() => onRun("replay")}
              disabled={pending !== null}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-700/25 bg-beige-50 px-4 py-2.5 text-sm font-semibold text-navy-800 transition hover:border-navy-700/45 hover:bg-beige-100 disabled:opacity-50"
            >
              <Play className="size-4" />
              {pending === "replay" ? "Loading replay…" : "Use reliable replay"}
            </button>
            {hasRun ? (
              <button type="button" onClick={onReset} disabled={pending !== null} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-navy-800 disabled:opacity-50">
                <RotateCcw className="size-3.5" /> {pending === "reset" ? "Resetting…" : "Reset packet"}
              </button>
            ) : null}
          </div>

          {!liveAvailable ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Live AI is not enabled for this deployment or state direction. The replay remains fully interactive and uses the same rule engine.
            </p>
          ) : (
            <p className="mt-3 text-xs text-state-verified">
              Live document reading is ready · {model.extraction?.model}
            </p>
          )}
          {error ? <p className="mt-3 rounded-md border border-state-defect/30 bg-state-defect-bg px-3 py-2 text-xs font-medium text-state-defect" role="alert">{error}</p> : null}
        </div>

        <div className="border-t border-navy-800/10 bg-beige-100 p-5 md:border-l md:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-600">What happens</p>
          <ol className="mt-4 space-y-3">
            <LauncherStep number="1" text="Read three synthetic records" />
            <LauncherStep number="2" text="Extract typed facts with provenance" />
            <LauncherStep number="3" text="Run consistency and validity rules" />
          </ol>
          {lastRun ? (
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-navy-800/10 pt-4 text-xs">
              <div><dt className="text-muted-foreground">Files</dt><dd className="mt-0.5 font-mono font-semibold text-navy-900">{lastRun.files_analyzed}</dd></div>
              <div><dt className="text-muted-foreground">Time</dt><dd className="mt-0.5 font-mono font-semibold text-navy-900">{lastRun.duration_ms ? `${(lastRun.duration_ms / 1000).toFixed(1)}s` : "instant"}</dd></div>
              <div><dt className="text-muted-foreground">Tokens</dt><dd className="mt-0.5 font-mono font-semibold text-navy-900">{tokenTotal?.toLocaleString() ?? "—"}</dd></div>
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LauncherStep({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex items-center gap-3 text-xs text-navy-900">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card font-mono text-[10px] font-bold text-navy-700 shadow-sm">{number}</span>
      <span>{text}</span>
    </li>
  );
}

function EvidencePanel({ documents }: { documents: EvidenceDocument[] }) {
  return (
    <section className="rounded-xl border border-navy-800/12 bg-card shadow-sm">
      <div className="border-b border-navy-800/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-600">
          Evidence workspace
        </p>
        <h2 className="mt-1 text-xl text-navy-900">Packet documents</h2>
      </div>
      {documents.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <FileSearch className="mx-auto size-6 text-navy-500" />
          <p className="mt-3 text-sm font-semibold text-navy-900">No documents analyzed yet</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Load the guided demo or open a requirement to add a synthetic file.
          </p>
          <a
            href="/api/demo-documents/rfa-application-rivera.pdf"
            className="mt-4 inline-flex text-xs font-semibold text-navy-700 underline underline-offset-4"
          >
            Download a sample document
          </a>
        </div>
      ) : (
        <div className="divide-y divide-navy-800/10">
          {documents.map((document) => (
            <div key={document.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-beige-200 text-navy-700">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-navy-900">{document.label}</p>
                    <span
                      className={
                        document.extraction_mode === "live_anthropic"
                          ? "rounded-full bg-navy-700 px-2 py-0.5 text-[10px] font-semibold text-white"
                          : "rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-semibold text-navy-700"
                      }
                    >
                      {document.extraction_mode === "live_anthropic" ? "Live AI" : "Verified replay"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {document.file_name} · {document.facts.length} extracted fact
                    {document.facts.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {document.facts.length > 0 ? (
                <dl className="mt-3 space-y-2 border-l-2 border-beige-300 pl-3">
                  {document.facts.map((fact) => (
                    <div key={fact.id}>
                      <dt className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <span>{fact.label}</span>
                        <span className={fact.confidence < 0.8 ? "font-semibold text-state-progress" : ""}>
                          {Math.round(fact.confidence * 100)}% confidence
                          {fact.confidence < 0.8 ? " · review" : ""}
                        </span>
                      </dt>
                      <dd className="mt-0.5 break-words text-xs font-medium text-navy-900">
                        {fact.value}
                      </dd>
                      <dd className="mt-0.5 text-[10px] text-muted-foreground">
                        {fact.field ?? "Field not recorded"}
                        {fact.page ? ` · page ${fact.page}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-navy-800/10 px-5 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Values below 80% confidence require human review. Replayed extraction is labeled
        separately from live AI so the demo never implies a model call that did not occur.
      </div>
    </section>
  );
}

function TrustStep({
  icon: Icon,
  number,
  title,
  text,
}: {
  icon: typeof Sparkles;
  number: string;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-full border border-beige-100/20 bg-white/5 text-gold">
        <Icon className="size-4" />
        <span className="sr-only">Step {number}</span>
      </span>
      <div>
        <p className="text-sm font-semibold text-beige-50">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-beige-300">{text}</p>
      </div>
    </li>
  );
}

export function countUniqueIssues(nodes: GraphNode[]) {
  return uniqueIssues(nodes).length;
}

export function countByState(nodes: GraphNode[]): Record<NodeState, number> {
  const counts = {} as Record<NodeState, number>;
  for (const state of Object.keys(NODE_STATE_STYLE) as NodeState[]) counts[state] = 0;
  for (const node of nodes) counts[node.state] += 1;
  return counts;
}
