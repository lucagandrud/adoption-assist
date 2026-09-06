/**
 * Voice transport for the interview room (CLAUDE.md §4a).
 *
 * One interface, two implementations:
 *
 *   WebSpeechTransport  Chrome's SpeechRecognition (webkit-prefixed) for the
 *                       subject's answers and SpeechSynthesis for the agent's
 *                       questions. No dependencies, no keys. NOTE FOR THE
 *                       CONSENT SCREEN: in Chrome, recognition sends audio to
 *                       Google's speech service for transcription.
 *
 *   TextTransport       The subject types. Always available. This is the
 *                       fallback the room degrades to when speech is missing,
 *                       and the toggle the subject can flip at any time.
 *
 * `createVoiceTransport()` feature-detects and falls back to text silently.
 * The room must never render broken because speech is unavailable — browser
 * speech APIs fail unpredictably on conference wifi, and a dead microphone
 * on stage is unrecoverable (docs/interview-agent-spec.md §10).
 *
 * Client-only. Every browser global is touched lazily so importing this
 * module on the server is harmless.
 */

export interface Utterance {
  text: string;
  startedAt: number;
  endedAt: number;
}

export interface VoiceTransport {
  readonly kind: "speech" | "text";
  /** Resolves when the question has finished being delivered. */
  speak(text: string): Promise<void>;
  /** Resolves with the subject's next complete answer. */
  listen(): Promise<Utterance>;
  /** Cancels any in-flight speak() or listen(). Pending promises reject. */
  stop(): void;
}

/** Thrown by a pending listen()/speak() when stop() interrupts it. */
export class TransportStopped extends Error {
  constructor() {
    super("transport stopped");
    this.name = "TransportStopped";
  }
}

/* ------------------------------------------------------------------------- */
/* Minimal typings for the Web Speech recognition API. TypeScript's DOM lib   */
/* ships SpeechSynthesis but not SpeechRecognition, and Chrome only exposes   */
/* the webkit-prefixed constructor.                                           */
/* ------------------------------------------------------------------------- */

interface RecognitionResultEvent extends Event {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
  >;
}

interface RecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function synthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** True when both halves of the Web Speech API are present. */
export function isSpeechSupported(): boolean {
  return recognitionCtor() !== null && synthesis() !== null;
}

/* ------------------------------------------------------------------------- */
/* Web Speech                                                                */
/* ------------------------------------------------------------------------- */

export interface WebSpeechOptions {
  lang?: string;
  /** Live partial transcript while the subject is still talking. */
  onInterim?: (text: string) => void;
  /** Milliseconds of silence after the last final result before we accept. */
  silenceMs?: number;
}

export class WebSpeechTransport implements VoiceTransport {
  readonly kind = "speech" as const;
  private recognition: Recognition | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private rejectPending: ((reason: Error) => void) | null = null;
  private readonly lang: string;
  private readonly onInterim?: (text: string) => void;
  private readonly silenceMs: number;

  constructor(options: WebSpeechOptions = {}) {
    this.lang = options.lang ?? "en-US";
    this.onInterim = options.onInterim;
    this.silenceMs = options.silenceMs ?? 1400;
  }

  speak(text: string): Promise<void> {
    const synth = synthesis();
    if (!synth) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      // Chrome cancels queued utterances if speak() is called while a prior
      // one is still playing. We never queue: cancel, then speak, and resolve
      // only on the 'end' event so the caller cannot overlap two questions.
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.lang;
      utterance.rate = 0.98;
      this.utterance = utterance;

      const done = () => {
        if (this.utterance !== utterance) return;
        this.utterance = null;
        this.rejectPending = null;
        resolve();
      };
      utterance.onend = done;
      utterance.onerror = (event) => {
        // 'interrupted' and 'canceled' are what stop() produces. Anything
        // else (no voices, audio busy) is still not fatal: the question is
        // on screen as text, so resolve and let the interview continue.
        if (event.error === "interrupted" || event.error === "canceled") {
          if (this.rejectPending) {
            const r = this.rejectPending;
            this.rejectPending = null;
            r(new TransportStopped());
          }
          return;
        }
        done();
      };
      this.rejectPending = reject;

      synth.speak(utterance);
    });
  }

  listen(): Promise<Utterance> {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      return Promise.reject(new Error("SpeechRecognition is not available"));
    }

    return new Promise<Utterance>((resolve, reject) => {
      const recognition = new Ctor();
      recognition.lang = this.lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      this.recognition = recognition;

      const startedAt = Date.now();
      let finalText = "";
      let interimText = "";
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        this.recognition = null;
        this.rejectPending = null;
        const text = (finalText + " " + interimText).replace(/\s+/g, " ").trim();
        try {
          recognition.stop();
        } catch {
          // Already stopped.
        }
        resolve({ text, startedAt, endedAt: Date.now() });
      };

      const armSilence = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (finalText.trim() || interimText.trim()) finish();
        }, this.silenceMs);
      };

      recognition.onresult = (event) => {
        interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += transcript + " ";
          else interimText += transcript;
        }
        this.onInterim?.((finalText + interimText).trim());
        armSilence();
      };

      recognition.onerror = (event) => {
        if (settled) return;
        // 'no-speech' fires after ~8s of silence; 'aborted' is our own stop().
        // Treat 'aborted' as stopped, everything else as an empty answer so
        // the room can offer text entry rather than hanging.
        if (event.error === "aborted") {
          settled = true;
          this.recognition = null;
          this.rejectPending = null;
          reject(new TransportStopped());
          return;
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          settled = true;
          this.recognition = null;
          this.rejectPending = null;
          reject(new Error("microphone permission denied"));
          return;
        }
        finish();
      };

      recognition.onend = () => {
        // Chrome ends continuous recognition on its own after a while. If we
        // have anything, deliver it; otherwise report an empty answer.
        if (!settled) finish();
      };

      this.rejectPending = (reason) => {
        if (settled) return;
        settled = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        this.recognition = null;
        reject(reason);
      };

      try {
        recognition.start();
      } catch (error) {
        this.rejectPending = null;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  stop(): void {
    const synth = synthesis();
    if (synth) synth.cancel();
    this.utterance = null;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Already gone.
      }
      this.recognition = null;
    }
    if (this.rejectPending) {
      const r = this.rejectPending;
      this.rejectPending = null;
      r(new TransportStopped());
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Text                                                                      */
/* ------------------------------------------------------------------------- */

/**
 * The subject types their answer. The room renders an input and calls
 * `submit()` when they press Send; the pending `listen()` resolves with it.
 */
export class TextTransport implements VoiceTransport {
  readonly kind = "text" as const;
  private pending:
    | { resolve: (u: Utterance) => void; reject: (e: Error) => void; startedAt: number }
    | null = null;

  /** Questions are shown as text; nothing to play. */
  speak(): Promise<void> {
    return Promise.resolve();
  }

  listen(): Promise<Utterance> {
    this.stop();
    return new Promise<Utterance>((resolve, reject) => {
      this.pending = { resolve, reject, startedAt: Date.now() };
    });
  }

  /** Called by the room's text input. No-op when nothing is listening. */
  submit(text: string): boolean {
    if (!this.pending) return false;
    const { resolve, startedAt } = this.pending;
    this.pending = null;
    resolve({ text: text.trim(), startedAt, endedAt: Date.now() });
    return true;
  }

  get isListening(): boolean {
    return this.pending !== null;
  }

  stop(): void {
    if (this.pending) {
      const { reject } = this.pending;
      this.pending = null;
      reject(new TransportStopped());
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Factory                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * The transport the room should start with. Speech when the browser has it,
 * text otherwise — silently. The room shows which one is live and lets the
 * subject switch, but it never shows an error for a missing API.
 */
export function createVoiceTransport(
  preferred: "speech" | "text",
  options: WebSpeechOptions = {},
): VoiceTransport {
  if (preferred === "speech" && isSpeechSupported()) {
    return new WebSpeechTransport(options);
  }
  return new TextTransport();
}
