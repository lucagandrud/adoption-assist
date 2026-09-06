"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import type { InterviewSession } from "@/lib/types";

/**
 * "{First name}'s AI Intern" — dispatch an interview to a household member.
 *
 * Creates a session, which mints a 7-day link, and shows the URL to copy.
 * Also lists the case's existing interviews with a path to each review
 * page. The naming is deliberate: a copilot that gathers, not a system that
 * decides (docs/interview-agent-spec.md §1).
 */
export function SendIntern({
  caseId,
  firstName,
  sessions,
  scripts,
}: {
  caseId: string;
  firstName: string;
  sessions: InterviewSession[];
  scripts: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subjectName, setSubjectName] = useState("");
  const [subjectRole, setSubjectRole] = useState("");
  const [scriptId, setScriptId] = useState(scripts[0]?.id ?? "");
  const [created, setCreated] = useState<InterviewSession | null>(null);
  const [copied, setCopied] = useState(false);

  const label = `${firstName}'s AI Intern`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setCreated(null);
    setCopied(false);

    const response = await fetch(`/api/cases/${caseId}/interviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject_name: subjectName,
        subject_role: subjectRole,
        script_id: scriptId,
      }),
    }).catch(() => null);

    setPending(false);
    if (!response || !response.ok) {
      const data = await response?.json().catch(() => ({}));
      setErrors(data?.errors ?? { _form: data?.error ?? "Could not create the interview." });
      return;
    }
    const data = (await response.json()) as { session: InterviewSession };
    setCreated(data.session);
    setSubjectName("");
    setSubjectRole("");
    router.refresh();
  }

  const linkFor = (session: InterviewSession) =>
    typeof window === "undefined" || !session.link_token
      ? ""
      : `${window.location.origin}/interview/${session.link_token}`;

  const [seeding, setSeeding] = useState(false);
  async function seedDemo() {
    setSeeding(true);
    setErrors({});
    const response = await fetch(`/api/cases/${caseId}/interviews/seed-demo`, { method: "POST" }).catch(() => null);
    setSeeding(false);
    if (!response || !response.ok) {
      setErrors({ _seed: "Could not load the demo interviews." });
      return;
    }
    router.refresh();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 bg-gold text-navy-900 hover:bg-gold/85"
      >
        Send {label}
        {sessions.length > 0 ? (
          <span className="ml-1 rounded-full bg-navy-900/15 px-1.5 text-[11px] font-semibold">
            {sessions.length}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-navy-800/20 bg-beige-100 sm:max-w-lg">
          <SheetHeader className="border-b border-navy-800/10 bg-card">
            <SheetTitle className="text-2xl text-navy-900">{label}</SheetTitle>
            <SheetDescription className="text-navy-800/75">
              Sends a household member a link to a fixed, scripted interview. They answer by voice
              or text; you get a verbatim transcript and draft fields to accept or edit. It gathers.
              You decide.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-7 px-4 py-6">
            <form onSubmit={submit} className="space-y-4 rounded-lg border border-navy-800/12 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
                New interview
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="subject-name" className="text-navy-800">Household member</Label>
                <Input
                  id="subject-name"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Full name (synthetic only)"
                  className="h-10 border-navy-800/20 bg-beige-50"
                  aria-invalid={errors.subject_name ? true : undefined}
                />
                {errors.subject_name ? <p className="text-sm text-destructive">{errors.subject_name}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject-role" className="text-navy-800">Role in household</Label>
                <Input
                  id="subject-role"
                  value={subjectRole}
                  onChange={(e) => setSubjectRole(e.target.value)}
                  placeholder="e.g. Prospective caregiver, spouse, adult child"
                  className="h-10 border-navy-800/20 bg-beige-50"
                  aria-invalid={errors.subject_role ? true : undefined}
                />
                {errors.subject_role ? <p className="text-sm text-destructive">{errors.subject_role}</p> : null}
              </div>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-navy-800">Script</span>
                <Select value={scriptId} onValueChange={(next) => { if (next) setScriptId(next); }}>
                  <SelectTrigger className="h-10 w-full border-navy-800/20 bg-beige-50">
                    <SelectValue>
                      {(selected: string | null) => scripts.find((s) => s.id === selected)?.label ?? "Select a script"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {scripts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Authored questions, asked in the same words to every household member.
                </p>
              </div>
              {errors._form ? <p role="alert" className="text-sm text-destructive">{errors._form}</p> : null}
              <Button type="submit" disabled={pending || !scriptId} className="h-10 bg-navy-800 text-beige-100 hover:bg-navy-700">
                {pending ? "Creating link…" : "Create interview link"}
              </Button>
            </form>

            {created ? (
              <div className="rounded-lg border border-gold/50 bg-gold-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
                  Link for {created.subject_name}
                </p>
                <p className="mt-1 text-[11px] text-navy-800/80">
                  Expires {new Date(created.expires_at).toLocaleString()}. Send it to them directly;
                  anyone with the link can complete the interview once.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    readOnly
                    value={linkFor(created)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-9 min-w-0 flex-1 rounded-md border border-navy-800/20 bg-beige-50 px-2 font-mono text-[11px] text-navy-900"
                  />
                  <Button type="button" size="sm" onClick={() => copy(linkFor(created))} className="h-9 bg-navy-800 text-beige-100 hover:bg-navy-700">
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : null}

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
                Interviews on this case
              </p>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="divide-y divide-navy-800/10 overflow-hidden rounded-lg border border-navy-800/12 bg-card">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-navy-900">{s.subject_name}</p>
                        <p className="text-[11px] text-muted-foreground">{s.subject_role}</p>
                      </div>
                      <StatusChip status={s.status} />
                      {s.status === "pending" || s.status === "in_progress" ? (
                        <button type="button" onClick={() => copy(linkFor(s))} className="text-[11px] text-navy-700 underline underline-offset-4">
                          Copy link
                        </button>
                      ) : null}
                      <Link href={`/cases/${caseId}/interviews/${s.id}`} className="text-[11px] font-semibold text-navy-800 underline underline-offset-4">
                        Review
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="rounded-lg border border-dashed border-navy-800/25 bg-card px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">Demo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Loads three completed interviews for fictional household members: one clean, one
                with a single clarification, one whose household size contradicts the seeded tax
                return. Accept the fields on each review page to see them reach the workflow.
              </p>
              {errors._seed ? <p role="alert" className="mt-1 text-sm text-destructive">{errors._seed}</p> : null}
              <Button type="button" size="sm" variant="outline" disabled={seeding} onClick={seedDemo} className="mt-2">
                {seeding ? "Loading…" : "Load 3 demo interviews"}
              </Button>
            </div>

            <p className="rounded-md border border-navy-800/12 bg-beige-200/70 px-3 py-2 text-xs leading-relaxed text-navy-800">
              The intern asks the same authored questions of every household member, records
              the answers verbatim, and drafts fields for you to accept. It never scores, rates,
              or evaluates anyone, and nothing it produces reaches the case until you accept it.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function StatusChip({ status }: { status: InterviewSession["status"] }) {
  const style =
    status === "reviewed"
      ? "bg-state-verified-bg text-state-verified border-state-verified/35"
      : status === "complete"
        ? "bg-state-progress-bg text-state-progress border-state-progress/35"
        : status === "in_progress"
          ? "bg-white text-navy-700 border-navy-700/30"
          : "bg-state-locked-bg text-state-locked border-state-locked/30";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}>
      {status.replace("_", " ")}
    </span>
  );
}
