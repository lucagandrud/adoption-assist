"use client";

import { useState } from "react";
import { ConsentGate } from "@/components/interview/consent-gate";
import { InterviewRoom } from "@/components/interview/InterviewRoom";
import type {
  InterviewScript,
  InterviewSessionPublic,
  InterviewTurn,
} from "@/lib/types";

/**
 * consent → room → done. Nothing in the room mounts until Continue is
 * pressed, so no browser permission prompt can appear before consent.
 */
export function InterviewFlow({
  token,
  session,
  script,
  priorTurns,
}: {
  token: string;
  session: InterviewSessionPublic;
  script: InterviewScript;
  priorTurns: InterviewTurn[];
}) {
  const [stage, setStage] = useState<"consent" | "room" | "done">("consent");

  if (stage === "consent") {
    return (
      <ConsentGate
        subjectName={session.subject_name}
        onContinue={() => setStage("room")}
      />
    );
  }

  if (stage === "done") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          Adoption Assist
        </p>
        <h1 className="mt-2 text-3xl text-navy-900">Thank you. That is everything.</h1>
        <p className="mt-3 text-sm leading-relaxed text-navy-800/80">
          Your answers have been recorded as a transcript for your caseworker to
          review. Nothing has been decided by this interview. You can close this
          window.
        </p>
      </main>
    );
  }

  return (
    <InterviewRoom
      token={token}
      session={session}
      script={script}
      priorTurns={priorTurns}
      onComplete={() => setStage("done")}
    />
  );
}
