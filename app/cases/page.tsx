import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listCases } from "@/lib/store";
import { jurisdictionName, isEncoded } from "@/lib/states";
import { AppHeader } from "@/components/app-header";
import { NewCaseForm } from "@/components/new-case-form";
import type { CaseRecord } from "@/lib/types";

export const metadata = { title: "Cases · ICPC Compliance Workbench" };

export default async function CasesPage() {
  const user = await requireUser();
  const cases = await listCases(user.id);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Caseload
            </p>
            <h1 className="mt-1 text-3xl text-navy-900">
              Good to see you, {user.name.split(/\s+/)[0]}.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a case to open its workflow, or open a new one.
            </p>
          </div>
          <NewCaseForm />
        </div>

        {cases.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-800/25 bg-beige-100/60 px-6 py-12 text-center text-sm text-muted-foreground">
            No cases yet. Open one to compose its workflow.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cases.map((record) => (
              <li key={record.id}>
                <CaseCard record={record} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function CaseCard({ record }: { record: CaseRecord }) {
  const covered =
    isEncoded(record.sending_state) && isEncoded(record.receiving_state);

  return (
    <Link
      href={`/workflow/${record.id}`}
      className="group block h-full rounded-xl border border-navy-800/15 bg-card p-5 shadow-sm transition hover:border-navy-700/45 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg leading-snug text-navy-900 group-hover:text-navy-700">
          {record.label}
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {record.id}
        </span>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm font-medium text-navy-800">
        <span>{jurisdictionName(record.sending_state)}</span>
        <span aria-label="sends to" className="text-navy-600">
          →
        </span>
        <span>{jurisdictionName(record.receiving_state)}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {record.sending_state} sends · {record.receiving_state} studies the home
        and decides
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-navy-800/10 pt-3 text-xs">
        <Meta label="Children" value={String(record.children_count)} />
        <Meta label="Relationship" value={pretty(record.relationship)} />
        <Meta label="Received" value={record.window_start} />
      </dl>

      {!covered ? (
        <p className="mt-3 rounded border border-gold/40 bg-gold-soft px-2 py-1 text-[11px] text-navy-800">
          Requirement data not yet encoded for this pair.
        </p>
      ) : null}
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-navy-800">{value}</dd>
    </div>
  );
}

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
