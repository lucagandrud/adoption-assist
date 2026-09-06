import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listCases } from "@/lib/store";
import { jurisdictionName, isEncoded } from "@/lib/states";
import { graphModelForCase } from "@/lib/workflow-model";
import { AppHeader } from "@/components/app-header";
import { NewCaseForm } from "@/components/new-case-form";
import type { CaseRecord, GraphModel } from "@/lib/types";

export const metadata = { title: "Cases · ICPC Preflight" };

type CaseCardData = {
  record: CaseRecord;
  model: GraphModel;
  documentCount: number;
  readyCount: number;
  attentionCount: number;
};

function uniqueIssueCount(model: GraphModel) {
  return new Set(
    model.nodes.flatMap(({ defects }) =>
      defects.map(
        (defect) =>
          `${defect.rule_id}:${defect.conflicting
            .map(({ fact_id }) => fact_id)
            .sort()
            .join(":")}`,
      ),
    ),
  ).size;
}

export default async function CasesPage() {
  const user = await requireUser();
  const cases = await listCases(user.id);
  const summaries: CaseCardData[] = await Promise.all(
    cases.map(async (record) => {
      const model = await graphModelForCase(record);
      return {
        record,
        model,
        documentCount: model.evidence?.documents.length ?? 0,
        readyCount: model.nodes.filter(({ state }) => state === "verified").length,
        attentionCount:
          uniqueIssueCount(model) + (model.validity?.at_risk_count ?? 0),
      };
    }),
  );
  const ordered = summaries.sort((left, right) => {
    if (left.attentionCount !== right.attentionCount) {
      return right.attentionCount - left.attentionCount;
    }
    if (left.documentCount === 0 && right.documentCount > 0) return 1;
    if (right.documentCount === 0 && left.documentCount > 0) return -1;
    return right.record.updated_at.localeCompare(left.record.updated_at);
  });
  const needingReview = ordered.filter(({ attentionCount }) => attentionCount > 0).length;
  const notAnalyzed = ordered.filter(({ documentCount }) => documentCount === 0).length;

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-7 sm:px-6 sm:py-9">
        <div className="mb-7 flex flex-wrap items-end gap-x-7 gap-y-4">
          <div className="mr-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Caseload</p>
            <h1 className="mt-1 text-3xl text-navy-900">Placement packets</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Prioritize packets with document conflicts or validity risks before interstate submission.
            </p>
          </div>
          <dl className="flex gap-6 text-right">
            <Stat label="Needs review" value={String(needingReview)} alert={needingReview > 0} />
            <Stat label="Not analyzed" value={String(notAnalyzed)} />
          </dl>
          <NewCaseForm />
        </div>

        {ordered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-800/25 bg-card px-6 py-14 text-center">
            <FileCheck2 className="mx-auto size-8 text-navy-500" />
            <h2 className="mt-3 text-xl text-navy-900">No placement packets yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open a synthetic case to compose its state-specific workflow.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ordered.map((summary) => <CaseCard key={summary.record.id} {...summary} />)}
          </div>
        )}
      </main>
    </>
  );
}

function CaseCard({ record, model, documentCount, readyCount, attentionCount }: CaseCardData) {
  const covered = isEncoded(record.sending_state) && isEncoded(record.receiving_state);
  const status = documentCount === 0
    ? { label: "Not analyzed", classes: "bg-beige-200 text-navy-700" }
    : attentionCount > 0
      ? { label: `${attentionCount} needs attention`, classes: "bg-state-defect-bg text-state-defect" }
      : { label: "No issues detected", classes: "bg-state-verified-bg text-state-verified" };
  const percent = model.nodes.length
    ? Math.round((readyCount / model.nodes.length) * 100)
    : 0;

  return (
    <Link
      href={`/workflow/${record.id}`}
      aria-label={`Open ${record.label}: ${status.label}`}
      className="group flex min-h-64 flex-col rounded-xl border border-navy-800/14 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-navy-700/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted-foreground">{record.id}</p>
          <h2 className="mt-1 truncate text-2xl text-navy-900">{record.label}</h2>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status.classes}`}>{status.label}</span>
      </div>

      <p className="mt-3 text-sm font-medium text-navy-800">
        {jurisdictionName(record.sending_state)} <span className="mx-1 text-navy-500">→</span> {jurisdictionName(record.receiving_state)}
      </p>
      <p className="mt-1 text-xs capitalize text-muted-foreground">
        {record.children_count} child{record.children_count === 1 ? "" : "ren"} · {record.relationship.replace(/_/g, " ")} · {record.placement_type}
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-navy-800/10 py-3 text-center">
        <CardStat label="Files" value={String(documentCount)} />
        <CardStat label="Ready" value={`${readyCount}/${model.nodes.length}`} />
        <CardStat label="Decision due" value={formatDate(model.case.projected_decision)} />
      </dl>

      <div className="mt-auto pt-4">
        {!covered ? (
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-gold">Requirements not yet encoded</p>
        ) : null}
        <div className="h-1.5 overflow-hidden rounded-full bg-beige-300" aria-label={`${percent}% of requirements ready`}>
          <div className="h-full rounded-full bg-navy-700" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-3 flex items-center justify-between text-xs font-semibold text-navy-700">
          Open preflight <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </p>
      </div>
    </Link>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-xs font-semibold text-navy-900">{value}</dd></div>;
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt><dd className={`mt-0.5 text-2xl font-semibold tabular-nums ${alert ? "text-state-defect" : "text-navy-900"}`}>{value}</dd></div>;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
