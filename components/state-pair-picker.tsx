"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { JURISDICTIONS, isEncoded, jurisdictionName } from "@/lib/states";

/**
 * Sending → receiving, with the direction spelled out.
 *
 * A caseworker who picks CA→TX when they meant TX→CA gets a confidently wrong
 * workflow, which is worse than no tool at all. So the arrow is literal, the
 * roles are labelled, and swapping is one deliberate button.
 */
export function StatePairPicker({
  sending,
  receiving,
  onChange,
  disabled,
  compact,
}: {
  sending: string;
  receiving: string;
  onChange: (next: { sending: string; receiving: string }) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const sameState = sending === receiving;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <StateSelect
          label="Sending state"
          hint="Holds the case; files the ICPC-100A"
          value={sending}
          disabled={disabled}
          compact={compact}
          onChange={(value) => onChange({ sending: value, receiving })}
        />

        <div
          aria-hidden
          className={compact ? "pb-2 text-navy-600" : "pb-2.5 text-navy-600"}
        >
          <svg width="26" height="14" viewBox="0 0 26 14" fill="none">
            <path
              d="M0 7h22M17 2l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <StateSelect
          label="Receiving state"
          hint="Conducts the home study; approves or denies"
          value={receiving}
          disabled={disabled}
          compact={compact}
          onChange={(value) => onChange({ sending, receiving: value })}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange({ sending: receiving, receiving: sending })}
          className="mb-0.5 border-navy-800/25 bg-beige-50 text-navy-800 hover:bg-beige-200"
        >
          Reverse direction
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {sameState ? (
          <span className="text-destructive">
            ICPC governs placements across state lines — the sending and
            receiving states must differ.
          </span>
        ) : (
          <>
            <span className="font-medium text-navy-800">
              {jurisdictionName(sending)} sends
            </span>{" "}
            → <span className="font-medium text-navy-800">
              {jurisdictionName(receiving)} receives, studies the home, and
              decides
            </span>
            .
          </>
        )}
      </p>

      <CoverageNotice sending={sending} receiving={receiving} />
    </div>
  );
}

function StateSelect({
  label,
  hint,
  value,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-navy-800">
        {label}
      </span>
      {!compact && (
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      )}
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className={`${compact ? "h-9 w-[190px]" : "h-11 w-[230px]"} border-navy-800/25 bg-beige-50`}
        >
          <SelectValue placeholder="Select a state">
            {(selected: string | null) =>
              selected
                ? `${jurisdictionName(selected)} (${selected})`
                : "Select a state"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {JURISDICTIONS.map((j) => (
            <SelectItem key={j.code} value={j.code}>
              <span className="font-mono text-xs text-muted-foreground">
                {j.code}
              </span>
              <span className="ml-2">{j.name}</span>
              {isEncoded(j.code) ? (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-state-verified">
                  encoded
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Every jurisdiction is selectable because the architecture generalizes to 50
 * states — but only the ones with sourced requirement data can produce a real
 * workflow, and pretending otherwise would be inventing regulation.
 */
function CoverageNotice({
  sending,
  receiving,
}: {
  sending: string;
  receiving: string;
}) {
  const missing = [sending, receiving].filter((code) => !isEncoded(code));
  if (missing.length === 0) return null;

  return (
    <p className="rounded-md border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-relaxed text-navy-800">
      <span className="font-semibold">No requirement data yet for </span>
      {missing.map((code) => jurisdictionName(code)).join(" and ")}. Requirements
      are encoded per jurisdiction in <code>/ontology</code>; California and
      Texas are the sourced set for this build. Selecting an unencoded state
      creates the case but cannot compose a verified workflow.
    </p>
  );
}
