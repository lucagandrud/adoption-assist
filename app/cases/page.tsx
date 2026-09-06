import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listCases } from "@/lib/store";
import { jurisdictionName, isEncoded } from "@/lib/states";
import { AppHeader } from "@/components/app-header";
import { NewCaseForm } from "@/components/new-case-form";
import type { CaseRecord } from "@/lib/types";

export const metadata = { title: "Case Verification · Foster Care Compliance AI" };

/**
 * The caseload grid.
 *
 * A case manager runs many placements at once, so the screen is a worked
 * surface rather than a list: tiles are sized by how much work is LEFT, which
 * puts the cases needing attention physically in front of you. Finished cases
 * shrink, grey out, and sink to the end, where they accumulate into rows you
 * scroll past rather than read.
 *
 * Tiles butt directly against one another. The doubled beige rule between them
 * is a drawn division, like ruled columns on a docket sheet — not a gap
 * between floating cards.
 */
export default async function CasesPage() {
  const user = await requireUser();
  const cases = await listCases(user.id);

  // Least complete first: the most work outstanding earns the most screen.
  // Finished cases sort to the end regardless of when they were touched.
  const ordered = [...cases].sort((a, b) => {
    const aDone = a.completion_pct >= 100;
    const bDone = b.completion_pct >= 100;
    if (aDone !== bDone) return aDone ? 1 : -1;
    return a.completion_pct - b.completion_pct;
  });

  const open = ordered.filter((c) => c.completion_pct < 100);
  const done = ordered.length - open.length;

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-8">
        {/* flex-wrap so the New case form, which goes full width when it
            opens, drops onto its own row instead of squeezing the stats. */}
        <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="mr-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Caseload
            </p>
            <h1 className="mt-1 text-3xl text-navy-900">Case Verification</h1>
          </div>
          <dl className="flex gap-6 text-right">
            <Stat label="Open" value={String(open.length)} />
            <Stat label="Filed" value={String(done)} />
          </dl>
          <NewCaseForm />
        </div>

        {ordered.length === 0 ? (
          <p className="border-[3px] border-double border-beige-500 bg-beige-100 px-6 py-12 text-center text-sm text-muted-foreground">
            No cases yet. Open one to compose its workflow.
          </p>
        ) : (
          <div className="grid auto-rows-[152px] grid-flow-dense grid-cols-1 sm:grid-cols-4 xl:grid-cols-6">
            {ordered.map((record) => (
              <CaseTile key={record.id} record={record} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Tile footprint is a function of work remaining, so the grid reflows on its
 * own as cases progress. Tailwind needs these class strings to exist literally,
 * hence the lookup table rather than computed spans.
 */
type Tier = "xl" | "lg" | "md" | "sm" | "done";

function tierFor(pct: number): Tier {
  if (pct >= 100) return "done";
  if (pct < 25) return "xl";
  if (pct < 50) return "lg";
  if (pct < 75) return "md";
  return "sm";
}

const SPAN: Record<Tier, string> = {
  xl: "sm:col-span-4 sm:row-span-2 xl:col-span-3 xl:row-span-2",
  lg: "sm:col-span-2 sm:row-span-2 xl:col-span-3 xl:row-span-2",
  md: "sm:col-span-2 sm:row-span-2 xl:col-span-2 xl:row-span-2",
  sm: "sm:col-span-2 sm:row-span-1 xl:col-span-2 xl:row-span-1",
  done: "sm:col-span-2 sm:row-span-1 xl:col-span-2 xl:row-span-1",
};

/** Type scales with footprint so a big tile does not read as a big empty box. */
const TYPE: Record<Tier, { name: string; pct: string; meta: string }> = {
  xl: { name: "text-4xl", pct: "text-6xl", meta: "text-sm" },
  lg: { name: "text-3xl", pct: "text-5xl", meta: "text-sm" },
  md: { name: "text-2xl", pct: "text-4xl", meta: "text-xs" },
  sm: { name: "text-lg", pct: "text-3xl", meta: "text-xs" },
  done: { name: "text-base", pct: "text-2xl", meta: "text-xs" },
};

function CaseTile({ record }: { record: CaseRecord }) {
  const pct = Math.max(0, Math.min(100, record.completion_pct));
  const tier = tierFor(pct);
  const type = TYPE[tier];
  const finished = tier === "done";
  const covered =
    isEncoded(record.sending_state) && isEncoded(record.receiving_state);

  return (
    <Link
      href={`/workflow/${record.id}`}
      aria-label={`${record.label}, ${pct}% verified`}
      className={[
        "group relative flex flex-col justify-between border-[3px] border-double border-beige-500 p-4 transition-colors",
        SPAN[tier],
        finished
          ? "bg-beige-300/60 text-navy-900/45 hover:bg-beige-300"
          : "bg-beige-100 hover:bg-beige-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={`${type.name} truncate leading-tight text-navy-900 ${finished ? "text-navy-900/50" : ""}`}
          >
            {record.label}
          </h2>
          <p
            className={`mt-1 font-mono ${type.meta} ${finished ? "text-navy-900/40" : "text-muted-foreground"}`}
          >
            {record.id}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`${type.pct} font-semibold leading-none tabular-nums ${finished ? "text-navy-900/45" : "text-navy-800"}`}
          >
            {pct}
            <span className="text-[0.5em] align-super">%</span>
          </div>
          <p
            className={`mt-1 ${type.meta} uppercase tracking-wide ${finished ? "text-navy-900/40" : "text-muted-foreground"}`}
          >
            {finished ? "Filed" : "Verified"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <p
          className={`${type.meta} font-medium ${finished ? "text-navy-900/45" : "text-navy-800"}`}
        >
          {jurisdictionName(record.sending_state)}
          <span className="mx-1.5 text-navy-600" aria-label="to">
            →
          </span>
          {jurisdictionName(record.receiving_state)}
        </p>

        <p
          className={`${type.meta} ${finished ? "text-navy-900/40" : "text-muted-foreground"}`}
        >
          <span className="uppercase tracking-wide">Next</span>
          <span className="mx-1.5">·</span>
          <span className="tabular-nums">{formatDate(record.next_deadline)}</span>
          <span className="mx-1.5">·</span>
          {record.next_deadline_label}
        </p>

        {!covered && !finished ? (
          <p className="inline-block border border-gold/50 bg-gold-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-navy-800">
            Requirements not encoded
          </p>
        ) : null}

        {/* Completion rule. Solid fill, no gradient — it is a measurement. */}
        <div
          className="h-1.5 w-full bg-beige-400"
          role="presentation"
        >
          <div
            className={`h-full ${finished ? "bg-navy-900/30" : "bg-navy-700"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-navy-900">
        {value}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
