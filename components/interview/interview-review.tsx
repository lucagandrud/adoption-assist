"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  InterviewFact,
  InterviewScript,
  InterviewSession,
  InterviewTurn,
} from "@/lib/types";

/**
 * The review surface (CLAUDE.md §4a.3, §4a.4).
 *
 * Left: every draft fact, with its value, target fact id, the question that
 * produced it, and Accept / Edit. Right: the verbatim transcript. Clicking a
 * fact scrolls the transcript to the utterance it came from and highlights
 * it — a fact the caseworker cannot trace is a fact they will ignore.
 *
 * The DRAFT banner stays until every fact from a required question has been
 * accepted. Nothing here writes to the case fact store; acceptance is the
 * per-field write, and the graph reads only accepted facts.
 */
export function InterviewReview({
  caseId,
  session,
  script,
  initialTurns,
  initialFacts,
}: {
  caseId: string;
  session: InterviewSession;
  script: InterviewScript;
  initialTurns: InterviewTurn[];
  initialFacts: InterviewFact[];
}) {
  const router = useRouter();
  const [facts, setFacts] = useState<InterviewFact[]>(initialFacts);
  const [status, setStatus] = useState(session.status);
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blocks = useMemo(() => new Map(script.blocks.map((b) => [b.id, b])), [script]);
  const turns = initialTurns;

  const requiredFacts = facts.filter((f) => blocks.get(f.block_id)?.required);
  const requiredAccepted = requiredFacts.filter((f) => f.accepted).length;
  const allRequiredAccepted =
    requiredFacts.length > 0 && requiredAccepted === requiredFacts.length;

  /** Required target facts the interview never captured — shown, not hidden. */
  const missing = script.blocks
    .filter((b) => b.required)
    .flatMap((b) =>
      b.target_facts
        .filter((id) => !facts.some((f) => f.block_id === b.id && f.fact_id === id))
        .map((id) => ({ block: b, fact_id: id })),
    );

  const jumpTo = useCallback((turnIndex: number) => {
    setSelectedTurn(turnIndex);
    document
      .getElementById(`turn-${turnIndex}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  async function accept(fact: InterviewFact, value?: string) {
    setBusy(fact.id);
    setError(null);
    const response = await fetch(
      `/api/cases/${caseId}/interviews/${session.id}/facts/${fact.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value !== undefined ? { value } : {}),
      },
    ).catch(() => null);
    setBusy(null);
    if (!response || !response.ok) {
      setError("Could not accept that field.");
      return;
    }
    const data = (await response.json()) as { fact: InterviewFact };
    setFacts((prev) => prev.map((f) => (f.id === data.fact.id ? data.fact : f)));
    setEditing(null);
  }

  async function revoke(fact: InterviewFact) {
    setBusy(fact.id);
    setError(null);
    const response = await fetch(
      `/api/cases/${caseId}/interviews/${session.id}/facts/${fact.id}`,
      { method: "DELETE" },
    ).catch(() => null);
    setBusy(null);
    if (!response || !response.ok) {
      setError("Could not revoke that field.");
      return;
    }
    const data = (await response.json()) as { fact: InterviewFact };
    setFacts((prev) => prev.map((f) => (f.id === data.fact.id ? data.fact : f)));
  }

  async function markReviewed() {
    setBusy("session");
    const response = await fetch(`/api/cases/${caseId}/interviews/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    }).catch(() => null);
    setBusy(null);
    if (!response || !response.ok) {
      setError("Could not mark the interview reviewed.");
      return;
    }
    setStatus("reviewed");
    router.refresh();
  }

  const reviewed = status === "reviewed";

  return (
    <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-6">
      {/* The banner. Unmissable until every required field is accepted. */}
      {reviewed ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 border-[3px] border-double border-state-verified/50 bg-state-verified-bg px-4 py-3">
          <span className="rounded bg-state-verified px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Reviewed
          </span>
          <p className="text-sm text-navy-900">
            Every required field has been accepted by a caseworker. Accepted facts now feed the
            case workflow. This is a record of what was said, not an assessment of the household.
          </p>
        </div>
      ) : allRequiredAccepted ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 border-[3px] border-double border-gold/60 bg-gold-soft px-4 py-3">
          <span className="rounded bg-gold px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-navy-900">
            All required fields accepted
          </span>
          <p className="flex-1 text-sm text-navy-900">
            Mark the interview reviewed to close it out.
          </p>
          <Button
            type="button"
            disabled={busy === "session"}
            onClick={markReviewed}
            className="bg-navy-800 text-beige-100 hover:bg-navy-700"
          >
            Mark as reviewed
          </Button>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-3 border-[3px] border-double border-state-defect/60 bg-state-defect-bg px-4 py-3">
          <span className="rounded bg-state-defect px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Draft — not reviewed
          </span>
          <p className="text-sm text-navy-900">
            {requiredAccepted} of {requiredFacts.length} required fields accepted. Nothing below
            reaches the case until you accept it. Every value is the assistant&apos;s reading of
            the words on the right; the words are the record.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Intake interview · {script.label}
          </p>
          <h1 className="mt-1 text-3xl text-navy-900">{session.subject_name}</h1>
          <p className="text-sm text-muted-foreground">
            {session.subject_role} · session <span className="font-mono">{session.id.slice(0, 8)}</span> ·{" "}
            {status.replace("_", " ")}
            {session.completed_at ? ` · completed ${new Date(session.completed_at).toLocaleString()}` : ""}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {turns.length} turns · {facts.length} draft fields
        </p>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* LEFT — extracted fields */}
        <section className="min-w-0">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
            Extracted fields
          </h2>
          {facts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-navy-800/25 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              No fields were extracted. The transcript on the right is still the record.
            </p>
          ) : null}
          <ul className="space-y-3">
            {facts.map((fact) => {
              const block = blocks.get(fact.block_id);
              const isSelected = selectedTurn === fact.turn_index;
              const isEditing = editing === fact.id;
              return (
                <li
                  key={fact.id}
                  className={[
                    "rounded-lg border bg-card transition",
                    fact.accepted ? "border-state-verified/45" : "border-navy-800/15",
                    isSelected ? "ring-2 ring-navy-700 ring-offset-1" : "",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => jumpTo(fact.turn_index)}
                    className="w-full px-4 pt-3 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-navy-800">{fact.fact_id}</span>
                      {block?.required ? (
                        <span className="rounded border border-navy-800/20 bg-beige-200 px-1.5 py-px text-[10px] uppercase tracking-wide text-navy-800">
                          required
                        </span>
                      ) : (
                        <span className="rounded border border-navy-800/15 px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                          optional
                        </span>
                      )}
                      {fact.accepted ? (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-state-verified px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          ✓ Accepted
                        </span>
                      ) : (
                        <span className="ml-auto rounded-full border border-state-defect/40 bg-state-defect-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-state-defect">
                          Draft
                        </span>
                      )}
                    </div>

                    {isEditing ? null : (
                      <p className="mt-2 text-lg leading-snug text-navy-900">{fact.value}</p>
                    )}

                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      From turn <span className="font-mono">#{fact.turn_index}</span>
                      {block ? ` · asked by "${block.id}"` : ""} · provenance: interview
                    </p>
                    <p className="mt-1 border-l-2 border-gold/60 pl-2 text-xs italic text-navy-800/80">
                      &ldquo;{fact.verbatim}&rdquo;
                    </p>
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-800/10 px-4 py-2.5">
                    {isEditing ? (
                      <form
                        className="flex w-full flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          accept(fact, editValue);
                        }}
                      >
                        <input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          autoFocus
                          className="h-9 min-w-0 flex-1 rounded-md border border-navy-800/25 bg-beige-50 px-2.5 text-sm text-navy-900 outline-none focus-visible:border-navy-700"
                        />
                        <Button type="submit" size="sm" disabled={busy === fact.id} className="bg-navy-800 text-beige-100 hover:bg-navy-700">
                          Save and accept
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : fact.accepted ? (
                      <>
                        <span className="text-[11px] text-muted-foreground">
                          Accepted {fact.accepted_at ? new Date(fact.accepted_at).toLocaleString() : ""}
                        </span>
                        {!reviewed ? (
                          <Button type="button" size="sm" variant="ghost" disabled={busy === fact.id} onClick={() => revoke(fact)} className="ml-auto">
                            Revoke
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" disabled={busy === fact.id || reviewed} onClick={() => accept(fact)} className="bg-navy-800 text-beige-100 hover:bg-navy-700">
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy === fact.id || reviewed}
                          onClick={() => {
                            setEditing(fact.id);
                            setEditValue(fact.value);
                          }}
                        >
                          Edit
                        </Button>
                        <button type="button" onClick={() => jumpTo(fact.turn_index)} className="ml-auto text-[11px] text-navy-700 underline underline-offset-4">
                          Show in transcript
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {missing.length > 0 ? (
            <div className="mt-5 rounded-lg border border-gold/40 bg-gold-soft px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-800">
                Not captured
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-navy-800">
                {missing.map((m) => (
                  <li key={`${m.block.id}:${m.fact_id}`}>
                    <span className="font-mono">{m.fact_id}</span> — no value was extracted from the
                    answer to &ldquo;{m.block.id}&rdquo;. Read the transcript; if the answer is there,
                    it needs to be keyed in through the ordinary process.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* RIGHT — verbatim transcript */}
        <section className="min-w-0">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">
            Verbatim transcript
          </h2>
          <ol className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto rounded-lg border border-navy-800/15 bg-card px-4 py-3">
            {turns.length === 0 ? (
              <li className="text-sm text-muted-foreground">No turns recorded yet.</li>
            ) : null}
            {turns.map((turn) => {
              const produced = facts.filter((f) => f.turn_index === turn.turn_index);
              const isSelected = selectedTurn === turn.turn_index;
              return (
                <li
                  key={turn.turn_index}
                  id={`turn-${turn.turn_index}`}
                  onClick={() => setSelectedTurn(turn.turn_index)}
                  className={[
                    "-mx-2 cursor-pointer rounded-md px-2 py-1.5 transition",
                    isSelected ? "bg-gold-soft ring-2 ring-gold/70" : "hover:bg-beige-100",
                  ].join(" ")}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/55">
                    {turn.speaker === "agent" ? "Interviewer" : session.subject_name}
                    <span className="ml-1.5 font-mono font-normal normal-case tracking-normal">#{turn.turn_index}</span>
                    {produced.length > 0 ? (
                      <span className="ml-2 rounded bg-navy-800/10 px-1.5 py-px font-normal normal-case tracking-normal text-navy-800">
                        {produced.length} field{produced.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </p>
                  <p className={`mt-0.5 text-sm leading-relaxed ${turn.speaker === "agent" ? "text-navy-800/80" : "text-navy-900"}`}>
                    {turn.text}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Retained verbatim. Click a field on the left to jump to the words that produced it.
          </p>
        </section>
      </div>
    </main>
  );
}
