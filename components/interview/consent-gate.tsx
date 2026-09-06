"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Consent before the microphone (CLAUDE.md §4a.5).
 *
 * Rendered before any getUserMedia or SpeechRecognition call. Every sentence
 * below is a plain statement of what happens; none of it is boilerplate to
 * scroll past. The Continue button is the only way forward and it is
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
        Your caseworker has asked you to answer a short set of questions. Please
        read the following before continuing.
      </p>

      <ul className="mt-6 space-y-3 border-[3px] border-double border-beige-500 bg-beige-100 p-5 text-sm leading-relaxed text-navy-900">
        <Item>
          <strong>Your answers are recorded as a written transcript.</strong> If
          you answer by voice, your speech is transcribed to text. The transcript
          is kept and shown to your caseworker exactly as spoken.
        </Item>
        <Item>
          <strong>
            In Chrome, the browser&apos;s speech service sends your audio to
            Google for transcription.
          </strong>{" "}
          If you prefer that your audio not leave this device, choose{" "}
          <em>Type my answers</em> instead of speaking. You can switch at any
          time.
        </Item>
        <Item>
          <strong>Video is previewed only.</strong> Your camera, if you allow
          it, is shown on your own screen so the session feels like a call. No
          video is recorded, uploaded, or stored. Declining the camera does not
          affect the interview.
        </Item>
        <Item>
          <strong>Every question is fixed in advance.</strong> Every household
          member is asked the same questions in the same words. The assistant
          may ask you to repeat or clarify an answer once, and nothing else.
        </Item>
        <Item>
          <strong>A licensed caseworker reviews everything.</strong> The
          assistant only writes down what you say. Every value it records is a
          draft until your caseworker reads it and accepts it.
        </Item>
        <Item>
          <strong>This interview does not make any decision about the placement.</strong>{" "}
          It does not score, rate, or evaluate you. The decision is made by
          people, through the ordinary process, and this is one input to it.
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
          I have read the above and I agree to answer these questions. I
          understand a caseworker will review my answers.
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
