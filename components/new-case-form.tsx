"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatePairPicker } from "@/components/state-pair-picker";

const RELATIONSHIPS = [
  { value: "relative", label: "Relative caregiver" },
  { value: "parent", label: "Parent" },
  { value: "fictive_kin", label: "Fictive kin" },
  { value: "non_relative", label: "Non-relative foster placement" },
];

const PLACEMENT_TYPES = [
  { value: "foster", label: "Foster placement" },
  { value: "adoption", label: "Adoptive placement" },
  { value: "parent", label: "Placement with a parent" },
  { value: "residential", label: "Residential facility" },
];

export function NewCaseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [label, setLabel] = useState("");
  const [pair, setPair] = useState({ sending: "CA", receiving: "TX" });
  const [relationship, setRelationship] = useState("relative");
  const [placementType, setPlacementType] = useState("foster");
  const [childrenCount, setChildrenCount] = useState("1");
  const [windowStart, setWindowStart] = useState(
    new Date().toISOString().slice(0, 10),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});

    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        sending_state: pair.sending,
        receiving_state: pair.receiving,
        relationship,
        placement_type: placementType,
        children_count: Number(childrenCount),
        window_start: windowStart,
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      const data = await response?.json().catch(() => ({}));
      setErrors(data?.errors ?? { _form: "Could not create the case." });
      setPending(false);
      return;
    }

    setPending(false);
    setOpen(false);
    setLabel("");

    // Land back on the caseload grid rather than jumping into the workflow, so
    // the new case is visibly added to the board. It opens at 0% verified, so
    // it takes the largest tile and sorts to the front — the most work
    // outstanding earns the most screen.
    router.push("/cases");
    router.refresh();
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="bg-navy-800 text-beige-100 hover:bg-navy-700"
      >
        New case
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full border-[3px] border-double border-beige-500 bg-beige-100 p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg text-navy-900">Open a case</h2>
          <p className="text-sm text-muted-foreground">
            Synthetic records only. Do not enter a real family&apos;s details.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="label" className="text-navy-800">
            Case label
          </Label>
          <Input
            id="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Rivera — sibling pair"
            className="h-11 max-w-md border-navy-800/20 bg-beige-50"
            aria-invalid={errors.label ? true : undefined}
          />
          {errors.label ? (
            <p className="text-sm text-destructive">{errors.label}</p>
          ) : null}
        </div>

        <div className="border border-beige-500 bg-beige-200/60 p-4">
          <StatePairPicker
            sending={pair.sending}
            receiving={pair.receiving}
            onChange={setPair}
          />
          {errors.receiving_state ? (
            <p className="mt-2 text-sm text-destructive">
              {errors.receiving_state}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Choice
            label="Relationship"
            value={relationship}
            onChange={setRelationship}
            options={RELATIONSHIPS}
          />
          <Choice
            label="Placement type"
            value={placementType}
            onChange={setPlacementType}
            options={PLACEMENT_TYPES}
          />
          <div className="space-y-1.5">
            <Label htmlFor="children" className="text-navy-800">
              Children
            </Label>
            <Input
              id="children"
              type="number"
              min={1}
              max={12}
              value={childrenCount}
              onChange={(event) => setChildrenCount(event.target.value)}
              className="h-11 border-navy-800/20 bg-beige-50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="window" className="text-navy-800">
              Request received
            </Label>
            <Input
              id="window"
              type="date"
              value={windowStart}
              onChange={(event) => setWindowStart(event.target.value)}
              className="h-11 border-navy-800/20 bg-beige-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Starts the 180-day decision window.
            </p>
          </div>
        </div>

        {errors._form ? (
          <p role="alert" className="text-sm text-destructive">
            {errors._form}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-11 bg-navy-800 text-beige-100 hover:bg-navy-700"
        >
          {pending ? "Opening…" : "Open case"}
        </Button>
      </div>
    </form>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-navy-800">{label}</span>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        <SelectTrigger className="h-11 w-full border-navy-800/20 bg-beige-50">
          <SelectValue>
            {(selected: string | null) =>
              options.find((option) => option.value === selected)?.label ??
              "Select"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
