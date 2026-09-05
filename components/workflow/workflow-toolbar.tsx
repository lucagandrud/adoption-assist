"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatePairPicker } from "@/components/state-pair-picker";
import type { CaseRecord } from "@/lib/types";

/**
 * The top bar of the dashboard: which case, and which direction.
 *
 * Changing the pair writes to the case and re-renders the server component,
 * so the workflow below is always the workflow for what is selected here.
 */
export function WorkflowToolbar({
  cases,
  current,
}: {
  cases: CaseRecord[];
  current: CaseRecord;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [pair, setPair] = useState({
    sending: current.sending_state,
    receiving: current.receiving_state,
  });

  async function changePair(next: { sending: string; receiving: string }) {
    setPair(next);
    if (next.sending === next.receiving) return;

    setSaving("saving");
    const response = await fetch(`/api/cases/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sending_state: next.sending,
        receiving_state: next.receiving,
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setSaving("error");
      return;
    }

    setSaving("saved");
    startTransition(() => router.refresh());
  }

  return (
    <div className="border-b border-navy-800/12 bg-card">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-end gap-x-8 gap-y-3 px-6 py-3">
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-navy-800">
            Case
          </span>
          <Select
            value={current.id}
            onValueChange={(id) => {
              if (id) router.push(`/workflow/${id}`);
            }}
          >
            <SelectTrigger className="h-9 w-[290px] border-navy-800/25 bg-beige-50">
              <SelectValue>
                {(selected: string | null) =>
                  cases.find((record) => record.id === selected)?.label ??
                  "Select a case"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cases.map((record) => (
                <SelectItem key={record.id} value={record.id}>
                  {record.label}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {record.sending_state}→{record.receiving_state}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            href="/cases"
            className="inline-block text-[11px] text-navy-700 underline underline-offset-4"
          >
            All cases
          </Link>
        </div>

        <div className="border-l border-navy-800/12 pl-8">
          <StatePairPicker
            sending={pair.sending}
            receiving={pair.receiving}
            onChange={changePair}
            disabled={isPending || saving === "saving"}
            compact
          />
        </div>

        <p className="ml-auto pb-1 text-xs text-muted-foreground" role="status">
          {saving === "saving" || isPending
            ? "Recomposing workflow…"
            : saving === "saved"
              ? "Case updated."
              : saving === "error"
                ? "Could not update the case."
                : ""}
        </p>
      </div>
    </div>
  );
}
