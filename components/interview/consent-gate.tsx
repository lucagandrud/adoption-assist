"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Consent before the microphone (CLAUDE.md §4a.5).
 *
 * Rendered before any getUserMedia or SpeechRecognition call. Kept short so it
 * is actually read. The Continue button is the only way forward and stays
 * disabled until the box is ticked.
 */
export function ConsentGate({
  subjectName,
  onContinue,
}: {
  subjectName: string;
  onContinue: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
        Adoption Assist · Intake interview
      </p>
      <h1 className="mt-2 text-3xl text-navy-900">
        Before we begin{subjectName ? `, ${subjectName}` : ""}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-navy-800/85">
        Your caseworker asked you to answer a short set of questions. Please read
        this first.
      </p>

      <ul className="mt-6 space-y-2.5 border-[3px] border-double border-beige-500 bg-beige-100 p-5 text-sm leading-relaxed text-navy-900">
        <Item>
          Your answers are saved as a written transcript. Your caseworker reads
          it in your own words.
        </Item>
        <Item>
          If you speak, Chrome sends your audio to Google to turn it into text.
          Choose <em>Type my answers</em> if you would rather it did not.
        </Item>
        <Item>
          Your camera shows only on your screen. No video is saved. You can skip
          the camera and still answer.
        </Item>
        <Item>
          Every household member gets these same questions in the same words.
        </Item>
        <Item>
          A licensed caseworker reviews everything you say.
        </Item>
        <Item>
          This interview decides nothing. It does not score or rate you.
        </Item>
      </ul>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-navy-900">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 size-4 accent-navy-800"
        />
        <span>
          I have read this and I agree to answer these questions.
        </span>
      </label>

      <div className="mt-6 flex items-center gap-4">
        <Button
          type="button"
          disabled={!agreed}
          onClick={onContinue}
          className="h-11 bg-navy-800 px-6 text-beige-100 hover:bg-navy-700"
        >
          Continue
        </Button>
        <p className="text-xs text-muted-foreground">
          Your browser will ask for camera and microphone permission next.
        </p>
      </div>
    </main>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
      <span>{children}</span>
    </li>
  );
}
