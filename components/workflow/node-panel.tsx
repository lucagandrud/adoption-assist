"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NODE_STATE_STYLE } from "@/lib/node-state";
import type { Defect, GraphNode } from "@/lib/types";

export function NodePanel({
  requirement,
  onClose,
}: {
  requirement: GraphNode | null;
  onClose: () => void;
}) {
  const style = requirement ? NODE_STATE_STYLE[requirement.state] : null;

  return (
    <Sheet
      open={Boolean(requirement)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto border-navy-800/20 bg-beige-100 sm:max-w-xl"
      >
        {requirement && style ? (
          <>
            <SheetHeader className="border-b border-navy-800/10 bg-card">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.chip}`}
                >
                  <span className={`size-1.5 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
                {requirement.on_critical_path ? (
                  <span className="rounded-full border border-gold/50 bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-navy-800">
                    On the critical path
                  </span>
                ) : (
                  <span className="rounded-full border border-navy-800/20 bg-beige-200 px-2.5 py-0.5 text-xs text-navy-800">
                    {requirement.slack_days} days of slack
                  </span>
                )}
              </div>
              <SheetTitle className="text-2xl text-navy-900">
                {requirement.label}
              </SheetTitle>
              <SheetDescription className="text-navy-800/75">
                {style.hint}
              </SheetDescription>
              <p className="font-mono text-[11px] text-muted-foreground">
                {requirement.requirement_id}
              </p>
            </SheetHeader>

            <div className="space-y-7 px-4 py-6">
              <Schedule requirement={requirement} />
              <Inputs requirement={requirement} />
              <Citation requirement={requirement} />
              {requirement.defects.length > 0 ? (
                <Defects defects={requirement.defects} />
              ) : null}
              <UploadSlot />
              <p className="rounded-md border border-navy-800/12 bg-beige-200/70 px-3 py-2 text-xs leading-relaxed text-navy-800">
                A green check means the paperwork for this requirement is
                complete and internally consistent. It is not an approval of the
                placement, and it is not a judgement about the family.
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Schedule({ requirement }: { requirement: GraphNode }) {
  return (
    <Section title="Schedule">
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Earliest start" value={requirement.earliest_start} />
        <Stat label="Earliest finish" value={requirement.earliest_finish} />
        <Stat
          label="Slack"
          value={
            requirement.on_critical_path
              ? "None"
              : `${requirement.slack_days} days`
          }
        />
      </dl>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-800/12 bg-card px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-nowrap font-mono text-[13px] text-navy-900">
        {value}
      </dd>
    </div>
  );
}

function Inputs({ requirement }: { requirement: GraphNode }) {
  const satisfied = requirement.inputs.filter((i) => i.satisfied).length;

  return (
    <Section
      title="Required inputs"
      aside={
        <span className="font-mono text-xs text-muted-foreground">
          {satisfied} of {requirement.inputs.length} satisfied
        </span>
      }
    >
      <ul className="divide-y divide-navy-800/10 overflow-hidden rounded-lg border border-navy-800/12 bg-card">
        {requirement.inputs.map((input) => (
          <li
            key={input.id}
            className="flex items-center gap-3 px-3.5 py-2.5 text-sm"
          >
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                input.satisfied
                  ? "bg-state-verified text-white"
                  : "border border-navy-800/25 bg-beige-200 text-muted-foreground"
              }`}
            >
              {input.satisfied ? "✓" : "·"}
            </span>
            <span className="flex-1 text-navy-900">{input.label}</span>
            <span className="rounded border border-navy-800/15 bg-beige-200 px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
              {input.kind}
            </span>
            <span className="sr-only">
              {input.satisfied ? "Satisfied" : "Outstanding"}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Citation({ requirement }: { requirement: GraphNode }) {
  return (
    <Section
      title="Governing citation"
      aside={
        requirement.verified ? (
          <span className="rounded border border-state-verified/40 bg-state-verified-bg px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-state-verified">
            Sourced
          </span>
        ) : (
          <span className="rounded border border-gold/50 bg-gold-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-navy-800">
            Unverified
          </span>
        )
      }
    >
      <div className="rounded-lg border border-navy-800/12 bg-card px-3.5 py-3">
        <p className="text-sm leading-relaxed text-navy-900">
          {requirement.citation.text}
        </p>
        {requirement.citation.url ? (
          <a
            href={requirement.citation.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-navy-700 underline underline-offset-4"
          >
            Open the source document
          </a>
        ) : null}
        {requirement.citation.retrieved ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Retrieved {requirement.citation.retrieved}
          </p>
        ) : null}
        {!requirement.verified ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            This requirement has no sourced citation yet, so it is shown as
            unverified rather than presented as regulation.
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function Defects({ defects }: { defects: Defect[] }) {
  return (
    <Section title="Defects">
      <ul className="space-y-4">
        {defects.map((defect) => (
          <li
            key={defect.rule_id}
            className="overflow-hidden rounded-lg border border-state-defect/40 bg-state-defect-bg"
          >
            <div className="border-b border-state-defect/25 px-3.5 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded bg-state-defect px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">
                  {defect.severity}
                </span>
                <span className="font-mono text-[11px] text-navy-800/70">
                  {defect.rule_id}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-navy-900">
                {defect.message}
              </p>
            </div>

            {/* Both sides of the contradiction, always. Naming one document
                would leave the caseworker to hunt for the other. */}
            <div className="grid gap-px bg-state-defect/20 sm:grid-cols-2">
              {defect.conflicting.map((source) => (
                <div key={source.fact_id} className="bg-card px-3.5 py-3">
                  <p className="text-xs font-semibold text-navy-900">
                    {source.document_name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {source.field}
                    {source.page !== null ? ` · page ${source.page}` : ""}
                  </p>
                  <p className="mt-2 rounded border border-navy-800/12 bg-beige-100 px-2 py-1.5 font-mono text-xs leading-snug text-navy-900">
                    {source.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="border-t border-state-defect/25 px-3.5 py-2 text-[11px] leading-relaxed text-navy-800/80">
              Rule source: {defect.citation.text}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function UploadSlot() {
  return (
    <Section title="Documents">
      <div className="rounded-lg border border-dashed border-navy-800/25 bg-card px-4 py-5 text-center">
        <p className="text-sm text-navy-900">Upload a document to verify</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Extraction reads the document into typed facts with page-and-field
          provenance, then the consistency rules run against the case&apos;s fact
          graph.
        </p>
        <Button
          type="button"
          disabled
          className="mt-3 bg-navy-800 text-beige-100 hover:bg-navy-700"
        >
          Upload — pipeline not wired yet
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Wired in Step 5 (<code>/extraction/pipeline.ts</code>). Synthetic
          documents only.
        </p>
      </div>
    </Section>
  );
}
