"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createVoiceTransport,
  isSpeechSupported,
  TextTransport,
  TransportStopped,
  type VoiceTransport,
} from "@/lib/voice";
import {
  currentBlock,
  isComplete,
  nextTurnIndex,
  resumeState,
  transition,
  type MachineState,
} from "@/lib/interview-machine";
import type {
  InterviewResponse,
  InterviewScript,
  InterviewSessionPublic,
  InterviewTurn,
} from "@/lib/types";

/**
 * The interview room (CLAUDE.md §4a).
 *
 * What runs here:
 *   - the camera preview: getUserMedia video, shown on this screen, never
 *     recorded, never uploaded, never attached to anything that leaves the
 *     browser. A denied camera degrades to an avatar and changes nothing
 *     else — audio is the artifact.
 *   - the ask → listen → respond loop, driven by lib/interview-machine.ts.
 *     The machine decides the next prompt; this component only delivers it,
 *     captures the answer, persists both, and forwards the answer to
 *     /respond for extraction.
 *   - the voice/text toggle, always visible. Switching mid-question stops the
 *     current transport; the loop re-listens on the new one.
 *
 * Every turn is persisted the moment it completes, so a dead browser at
 * question 8 resumes at question 8.
 */

type RoomStatus = "starting" | "speaking" | "listening" | "thinking" | "finishing" | "ended";
type Mode = "speech" | "text";

interface LocalTurn extends InterviewTurn {
  /** Which block was being asked, for the transcript's small labels. */
  block_id?: string;
}

export function InterviewRoom({
  token,
  session,
  script,
  priorTurns,
  onComplete,
}: {
  token: string;
  session: InterviewSessionPublic;
  script: InterviewScript;
  priorTurns: InterviewTurn[];
  onComplete: () => void;
}) {
  const speechAvailable = typeof window !== "undefined" && isSpeechSupported();

  const [mode, setMode] = useState<Mode>(speechAvailable ? "speech" : "text");
  const [status, setStatus] = useState<RoomStatus>("starting");
  const [machine, setMachine] = useState<MachineState>(() => resumeState(script, priorTurns));
  const [transcript, setTranscript] = useState<LocalTurn[]>(priorTurns);
  const [interim, setInterim] = useState("");
  const [acknowledgment, setAcknowledgment] = useState<string | null>(null);
  const [camera, setCamera] = useState<"pending" | "on" | "denied">("pending");
  const [notice, setNotice] = useState<string | null>(null);
  const [extractionOffline, setExtractionOffline] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const modeRef = useRef<Mode>(mode);
  const transportRef = useRef<VoiceTransport | null>(null);
  const textTransportRef = useRef<TextTransport | null>(null);
  const machineRef = useRef<MachineState>(machine);
  const turnIndexRef = useRef<number>(nextTurnIndex(priorTurns));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const emptyListensRef = useRef(0);

  const block = currentBlock(script, machine);
  const total = script.blocks.length;
  const questionNumber = Math.min(machine.blockIndex + 1, total);

  /* ------------------------------ transport ------------------------------ */

  const buildTransport = useCallback(
    (next: Mode): VoiceTransport => {
      const transport = createVoiceTransport(next, { onInterim: setInterim });
      textTransportRef.current = transport instanceof TextTransport ? transport : null;
      return transport;
    },
    [],
  );

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === modeRef.current) return;
      if (next === "speech" && !speechAvailable) return;
      modeRef.current = next;
      setMode(next);
      setInterim("");
      const old = transportRef.current;
      transportRef.current = buildTransport(next);
      // Rejects the pending listen()/speak() with TransportStopped; the loop
      // picks the new transport up on its next iteration.
      old?.stop();
    },
    [buildTransport, speechAvailable],
  );

  /* ------------------------------ persistence ---------------------------- */

  const persistTurn = useCallback(
    async (turn: InterviewTurn): Promise<"ok" | "gone"> => {
      try {
        const response = await fetch(`/api/interview/${token}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(turn),
        });
        if (response.status === 410 || response.status === 409) return "gone";
        return "ok";
      } catch {
        // Offline for a moment. The turn is still in local state; the next
        // turn's write will land when the network is back. Do not stall.
        return "ok";
      }
    },
    [token],
  );

  const respond = useCallback(
    async (
      blockId: string,
      utterance: string,
      turnIndex: number,
      clarificationsUsed: number,
    ): Promise<InterviewResponse | "unavailable" | "gone"> => {
      try {
        const response = await fetch(`/api/interview/${token}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block_id: blockId,
            utterance,
            turn_index: turnIndex,
            clarifications_used: clarificationsUsed,
          }),
        });
        if (response.status === 410 || response.status === 409) return "gone";
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { reason?: string };
          setExtractionOffline(
            data.reason === "missing_key"
              ? "Fact extraction is not configured on this server. Your answers are still being recorded word for word."
              : "Fact extraction is temporarily unavailable. Your answers are still being recorded word for word.",
          );
          return "unavailable";
        }
        return (await response.json()) as InterviewResponse;
      } catch {
        setExtractionOffline(
          "Fact extraction is temporarily unavailable. Your answers are still being recorded word for word.",
        );
        return "unavailable";
      }
    },
    [token],
  );

  /* ------------------------------ the loop ------------------------------- */

  useEffect(() => {
    const run = { cancelled: false };
    // Idempotent start. React strict mode mounts, unmounts, and remounts this
    // effect in development; every ref the loop advances is reset here so the
    // second run begins exactly where the first would have. Turn writes are
    // idempotent on turn_index, so a write the first run got off before being
    // cancelled is simply overwritten with the same content.
    machineRef.current = resumeState(script, priorTurns);
    turnIndexRef.current = nextTurnIndex(priorTurns);
    emptyListensRef.current = 0;
    setMachine(machineRef.current);
    setTranscript(priorTurns);
    modeRef.current = mode;
    transportRef.current = buildTransport(modeRef.current);

    // Camera preview. Video only — the microphone belongs to the speech
    // transport, which requests it itself. Nothing here records.
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no mediaDevices");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (run.cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamera("on");
      } catch {
        if (!run.cancelled) setCamera("denied");
      }
    })();

    const setState = (next: MachineState) => {
      machineRef.current = next;
      setMachine(next);
    };

    const stamp = () => new Date().toISOString();

    const addTurn = (turn: LocalTurn) =>
      setTranscript((prev) => [...prev.filter((t) => t.turn_index !== turn.turn_index), turn]);

    const speakAndRecord = async (text: string, blockId: string | undefined) => {
      const turn_index = turnIndexRef.current++;
      const started_at = stamp();
      const turn: LocalTurn = {
        turn_index,
        speaker: "agent",
        text,
        started_at,
        ended_at: started_at,
        block_id: blockId,
      };
      addTurn(turn);
      const saved = await persistTurn(turn);
      if (saved === "gone") return "gone";
      try {
        await transportRef.current?.speak(text);
      } catch (error) {
        if (!(error instanceof TransportStopped)) throw error;
        // Mode switched mid-sentence. The text is on screen; carry on.
      }
      return "ok";
    };

    const loop = async () => {
      let state = machineRef.current;

      while (!run.cancelled && !isComplete(state)) {
        const current = currentBlock(script, state);
        if (!current) break;

        if (state.phase === "ask" || state.phase === "clarify") {
          setStatus("speaking");
          setAcknowledgment(null);
          setInterim("");
          const result = await speakAndRecord(state.pendingPrompt ?? current.prompt, current.id);
          if (run.cancelled) return;
          if (result === "gone") {
            setFatal("This link is no longer valid. Your answers so far have been saved.");
            setStatus("ended");
            return;
          }
          state = transition(script, state, { type: "PROMPT_DELIVERED" });
          setState(state);
          continue;
        }

        if (state.phase === "listen") {
          setStatus("listening");
          setInterim("");
          let utterance: { text: string; startedAt: number; endedAt: number };
          try {
            const transport = transportRef.current;
            if (!transport) throw new Error("no transport");
            utterance = await transport.listen();
          } catch (error) {
            if (run.cancelled) return;
            if (error instanceof TransportStopped) continue; // mode switched; listen again
            // Microphone refused or recognition unavailable: fall back to
            // typing without losing the question.
            setNotice("The microphone is not available, so you can type your answers instead.");
            switchMode("text");
            continue;
          }
          if (run.cancelled) return;

          if (!utterance.text) {
            emptyListensRef.current += 1;
            if (modeRef.current === "speech") {
              if (emptyListensRef.current >= 3) {
                setNotice("I could not hear you. You can type your answer instead.");
                switchMode("text");
              } else {
                setNotice("I did not catch anything. Please try again, or switch to typing.");
              }
            }
            continue;
          }
          emptyListensRef.current = 0;
          setNotice(null);

          const turn_index = turnIndexRef.current++;
          const turn: LocalTurn = {
            turn_index,
            speaker: "subject",
            text: utterance.text,
            started_at: new Date(utterance.startedAt).toISOString(),
            ended_at: new Date(utterance.endedAt).toISOString(),
            block_id: current.id,
          };
          addTurn(turn);
          setInterim("");
          const saved = await persistTurn(turn);
          if (run.cancelled) return;
          if (saved === "gone") {
            setFatal("This link is no longer valid. Your answers so far have been saved.");
            setStatus("ended");
            return;
          }

          setStatus("thinking");
          const reply = await respond(current.id, utterance.text, turn_index, state.clarificationsUsed);
          if (run.cancelled) return;
          if (reply === "gone") {
            setFatal("This link is no longer valid. Your answers so far have been saved.");
            setStatus("ended");
            return;
          }

          if (reply === "unavailable") {
            // No facts for this answer; the transcript has it. Move on.
            state = transition(script, state, { type: "ADVANCE" });
            setState(state);
            continue;
          }

          if (reply.acknowledgment) {
            setAcknowledgment(reply.acknowledgment);
            setStatus("speaking");
            const ackResult = await speakAndRecord(reply.acknowledgment, current.id);
            if (run.cancelled) return;
            if (ackResult === "gone") {
              setFatal("This link is no longer valid. Your answers so far have been saved.");
              setStatus("ended");
              return;
            }
          }

          state = transition(script, state, {
            type: "ANSWERED",
            needsClarification: reply.needs_clarification,
            clarifyingQuestion: reply.clarifying_question,
          });
          setState(state);
          continue;
        }

        // Unreachable phases fall through to completion.
        break;
      }

      if (run.cancelled) return;
      setStatus("finishing");
      try {
        await fetch(`/api/interview/${token}/complete`, { method: "POST" });
      } catch {
        // The transcript is already persisted turn by turn.
      }
      if (run.cancelled) return;
      setStatus("ended");
      onComplete();
    };

    loop().catch((error) => {
      if (run.cancelled) return;
      setFatal(error instanceof Error ? error.message : "Something went wrong.");
      setStatus("ended");
    });

    return () => {
      run.cancelled = true;
      transportRef.current?.stop();
      transportRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // The loop is started exactly once per mount. Mode changes are handled
    // through refs so they do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [transcript.length, interim]);

  /* ------------------------------ text entry ----------------------------- */

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (textTransportRef.current?.submit(text)) setDraft("");
  };

  /* -------------------------------- render ------------------------------- */

  const initials = session.subject_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
      {/* Header: who, where we are, and the always-visible mode toggle. */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-navy-800/15 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Adoption Assist · Intake interview
          </p>
          <h1 className="mt-1 text-2xl text-navy-900">
            {session.subject_name || "Household member"}
            {session.subject_role ? (
              <span className="ml-2 text-base text-navy-800/60">· {session.subject_role}</span>
            ) : null}
          </h1>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Answer by">
          <ModeButton active={mode === "speech"} disabled={!speechAvailable} onClick={() => switchMode("speech")}>
            Speak my answers
          </ModeButton>
          <ModeButton active={mode === "text"} onClick={() => switchMode("text")}>
            Type my answers
          </ModeButton>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-navy-800/70">
          <span>
            Question {questionNumber} of {total}
            {machine.phase === "clarify" || (machine.phase === "listen" && machine.clarificationsUsed > 0)
              ? " · clarifying"
              : ""}
          </span>
          <span className="font-mono">{Math.round((machine.blockIndex / total) * 100)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full bg-beige-400" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={machine.blockIndex}>
          <div className="h-full bg-navy-700 transition-[width]" style={{ width: `${(machine.blockIndex / total) * 100}%` }} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column */}
        <div className="min-w-0 space-y-4">
          {/* Camera preview. Definite height on purpose: a percentage height
              on a flex child collapses to zero in this layout. */}
          <div className="relative h-[300px] w-full overflow-hidden rounded-lg border border-navy-800/20 bg-navy-900">
            {camera === "denied" ? (
              <div className="grid h-full w-full place-items-center">
                <div className="text-center">
                  <span className="mx-auto grid size-20 place-items-center rounded-full bg-gold/85 text-2xl font-semibold text-navy-900">
                    {initials || "?"}
                  </span>
                  <p className="mt-3 text-xs text-beige-300">Camera off. The interview continues by audio.</p>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
                aria-label="Your camera preview. Not recorded."
              />
            )}
            <span className="absolute left-3 top-3 rounded bg-navy-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-beige-100">
              Preview only · not recorded
            </span>
            {camera === "pending" ? (
              <span className="absolute bottom-3 left-3 text-xs text-beige-300">Waiting for camera permission…</span>
            ) : null}
          </div>

          {/* Current question, shown as text while it is spoken. */}
          <section className="rounded-lg border border-navy-800/15 bg-card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-800/60">
              {machine.phase === "clarify" || (machine.phase === "listen" && machine.clarificationsUsed > 0)
                ? "Clarifying question"
                : "Question"}
            </p>
            <p className="mt-2 text-xl leading-snug text-navy-900">
              {machine.pendingPrompt ??
                (machine.phase === "listen"
                  ? transcript.filter((t) => t.speaker === "agent").at(-1)?.text ?? block?.prompt
                  : block?.prompt) ??
                "…"}
            </p>
            {block ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Authored question <span className="font-mono">{block.id}</span>
                {!block.verified ? " · citation unverified" : ""}
              </p>
            ) : null}

            <StatusLine status={status} mode={mode} />

            {interim && mode === "speech" ? (
              <p className="mt-3 rounded border border-navy-800/10 bg-beige-100 px-3 py-2 text-sm italic text-navy-800/80">
                {interim}
              </p>
            ) : null}

            {acknowledgment && status !== "listening" ? (
              <p className="mt-3 text-sm text-navy-800/80">{acknowledgment}</p>
            ) : null}

            {mode === "text" && status === "listening" ? (
              <form onSubmit={submitDraft} className="mt-4 space-y-2">
                <label htmlFor="answer" className="sr-only">Your answer</label>
                <textarea
                  id="answer"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitDraft(event);
                    }
                  }}
                  rows={3}
                  autoFocus
                  placeholder="Type your answer and press Enter"
                  className="w-full rounded-lg border border-navy-800/20 bg-beige-50 px-3 py-2 text-sm text-navy-900 outline-none focus-visible:border-navy-700 focus-visible:ring-2 focus-visible:ring-navy-700/30"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Shift+Enter for a new line.</span>
                  <Button type="submit" disabled={!draft.trim()} className="bg-navy-800 text-beige-100 hover:bg-navy-700">
                    Send answer
                  </Button>
                </div>
              </form>
            ) : null}
          </section>

          {notice ? (
            <p role="status" className="rounded-md border border-gold/40 bg-gold-soft px-3 py-2 text-xs text-navy-800">
              {notice}
            </p>
          ) : null}
          {extractionOffline ? (
            <p role="status" className="rounded-md border border-navy-800/15 bg-beige-200/70 px-3 py-2 text-xs text-navy-800">
              {extractionOffline}
            </p>
          ) : null}
          {fatal ? (
            <p role="alert" className="rounded-md border border-state-defect/40 bg-state-defect-bg px-3 py-2 text-sm text-navy-900">
              {fatal}
            </p>
          ) : null}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Every question is fixed in advance and asked of every household member in the same
            words. This interview records what you say; it does not decide anything. A licensed
            caseworker reviews the transcript.
          </p>
        </div>

        {/* Right column: live verbatim transcript. Definite height. */}
        <aside className="flex h-[560px] min-w-0 flex-col rounded-lg border border-navy-800/15 bg-card">
          <div className="flex items-center justify-between border-b border-navy-800/10 px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-800">Transcript</h2>
            <span className="text-[11px] text-muted-foreground">{transcript.length} turns · saved as you go</span>
          </div>
          <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {transcript.length === 0 ? (
              <li className="text-xs text-muted-foreground">The transcript will appear here.</li>
            ) : null}
            {transcript.map((turn) => (
              <li key={turn.turn_index} className="text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/55">
                  {turn.speaker === "agent" ? "Interviewer" : session.subject_name || "You"}
                  <span className="ml-1.5 font-mono font-normal normal-case tracking-normal">#{turn.turn_index}</span>
                </p>
                <p className={`mt-0.5 leading-relaxed ${turn.speaker === "agent" ? "text-navy-800/85" : "text-navy-900"}`}>
                  {turn.text}
                </p>
              </li>
            ))}
            {interim && status === "listening" ? (
              <li className="text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-800/55">
                  {session.subject_name || "You"} · speaking…
                </p>
                <p className="mt-0.5 italic text-navy-800/70">{interim}</p>
              </li>
            ) : null}
            <div ref={transcriptEndRef} />
          </ol>
        </aside>
      </div>
    </main>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? "Speech is not available in this browser." : undefined}
      className={[
        "rounded-md border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-navy-800 bg-navy-800 text-beige-100"
          : "border-navy-800/25 bg-beige-50 text-navy-800 hover:bg-beige-200",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatusLine({ status, mode }: { status: RoomStatus; mode: Mode }) {
  const text =
    status === "starting"
      ? "Starting…"
      : status === "speaking"
        ? mode === "speech"
          ? "Reading the question aloud…"
          : "Please read the question."
        : status === "listening"
          ? mode === "speech"
            ? "Listening. Pause for a moment when you have finished."
            : "Type your answer below."
          : status === "thinking"
            ? "Writing that down…"
            : status === "finishing"
              ? "Saving…"
              : "Finished.";

  const dot =
    status === "listening" ? "bg-state-verified animate-pulse" : status === "thinking" ? "bg-gold animate-pulse" : "bg-navy-700";

  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-navy-800/80" role="status" aria-live="polite">
      <span className={`size-2 rounded-full ${dot}`} />
      {text}
    </p>
  );
}
