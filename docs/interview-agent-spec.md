# AI Intake Interview Agent — Build Spec

Target: ~3 hours with Claude Code (`--dangerously-skip-permissions`).
Repo: `icpc-compliance-engine`. Branch: `luca`.
Everything below lives in Luca-owned paths (`/app`, `/components`, `/lib`,
`/extraction`, `/demo`). No edits to `/ontology` or `/engines`.

---

## 1. What this is

An AI intake interviewer that a caseworker deploys per household member. It conducts
a structured, scripted interview over voice in the browser, produces a verbatim
transcript, extracts typed facts with provenance, and hands the caseworker a **draft**
for review.

UI name: **"{Caseworker first name}'s AI Intern"**. The naming is load-bearing; it
frames the tool as a copilot rather than a decision-maker, which is exactly the legal
posture required.

**Why this matters for ICPC specifically:** psycho-social evaluation requires
face-to-face interviews with each adult in the household. In an interstate case,
the sending-state worker may be a flight away. Every hour of scripted fact-gathering
moved off the caseworker's calendar is an hour returned, and the household members can
complete it whenever they want.

---

## 2. Architecture decision: hosted link, not meeting bot

**Do not build a bot that joins Zoom/Meet/Teams.** That needs Recall.ai or equivalent,
calendar OAuth, and per-platform handling. Days of work, fragile, and unnecessary.

The flow instead:

```
Caseworker opens a case
  └─ clicks "Send AI Intern" → picks household member
      └─ system mints a signed, expiring link
          └─ member opens link in any browser (no account)
              └─ consent screen → interview → transcript + facts
                  └─ caseworker reviews DRAFT, edits, accepts
                      └─ accepted facts flip node inputs to satisfied
```

This is what HireVue actually does. It is async, requires nothing installed, and you
own the entire surface.

**Video:** show the member's own camera preview via `getUserMedia` so it feels like a
call. **Do not record or store video.** It adds storage and privacy exposure for zero
demo value. Audio-derived transcript is the artifact.

---

## 3. Hard rules (these are the product, not compliance decoration)

1. **The question set is authored data, never generated.** Questions live in a JSON
   script keyed to fact ids. The LLM may only: acknowledge an answer, ask a bounded
   clarifying follow-up when an answer fails to populate its target fact, or advance
   to the next scripted question. It may never invent a substantive question. This is
   what makes "every family is asked the same thing in the same words" literally true.
2. **No scoring, rating, sentiment, tone, or affect analysis.** Ever. Not on the
   roadmap, not behind a flag. An agent that evaluates a family is the one thing that
   would make this indefensible.
3. **Everything is DRAFT until a human accepts it.** No output path bypasses review.
4. **Verbatim transcript is retained and shown.** Every extracted fact links to the
   exact utterance that produced it. Reviewability is what makes the tool usable by a
   skeptical caseworker; a fact you cannot trace is a fact they will ignore.
5. **No recommendation, no approval, no denial.** The agent gathers; the licensed
   social worker judges.
6. **Consent screen before the microphone turns on.** States what is recorded, that a
   human reviews everything, and that the interview does not decide anything.
7. **Synthetic data only.** Demo household members are fictional.

**Defensible claim to make in the pitch:** identical scripted questions for every
family, verbatim capture, no inference, full audit trail. That is a *procedural*
property you can demonstrate on stage. Do not claim measured bias reduction; you have
no study.

---

## 4. Voice stack

Primary: **Web Speech API** (`SpeechRecognition` + `SpeechSynthesis`). Zero
dependencies, zero API keys, works in Chrome, which is what you will demo in.

Ship a **text-chat fallback in the same component**, switchable by a toggle. Browser
speech APIs fail unpredictably on conference wifi and a dead microphone on stage is
unrecoverable.

Put both behind one interface so the implementation is swappable:

```ts
interface VoiceTransport {
  speak(text: string): Promise<void>
  listen(): Promise<{ text: string; startedAt: number; endedAt: number }>
  stop(): void
}
```

Optional upgrade only if you finish early: swap `listen()` for `MediaRecorder` plus a
transcription API. Do not start there.

---

## 5. Data model

Extend the existing contract rather than building a parallel system. An interview is
just another extraction source feeding the same fact graph the documents feed.

```ts
InterviewScript {
  id, label, applies_to            // e.g. "household_adult"
  blocks: {
    id, prompt,                    // verbatim question text
    target_facts: string[],        // fact ids this question populates
    required: boolean,
    followup_policy: "clarify_once" | "none",
    citation?: { text, url }       // which state requirement mandates this question
  }[]
}

InterviewSession {
  id, case_id, subject_name, subject_role
  script_id, status: "pending" | "in_progress" | "complete" | "reviewed"
  link_token, expires_at
  turns: { index, speaker: "agent" | "subject", text, started_at, ended_at }[]
  created_at, completed_at
}

// Provenance for interview-derived facts, parallel to document provenance
FactProvenance =
  | { source: "document", document_id, document_name, page, field }
  | { source: "interview", session_id, block_id, turn_index, verbatim: string }
```

`Defect.conflicting[]` already names both sides. An interview fact and a document fact
that disagree is a first-class defect and a great demo beat: the family says four
people live in the home, the tax return claims three dependents.

---

## 6. Build order

### Phase 0 — 20 min: schema and seams

- Supabase migration `0002_interviews.sql`: `interview_sessions`, `interview_turns`,
  `interview_facts`. RLS on all three keyed to the parent case's `owner_user_id`.
- Extend `lib/types.ts` with the shapes above.
- `extraction/interviews/household-adult.json`: 8–10 scripted blocks. Keep it short;
  a 10-minute interview demos better than a 40-minute one. Cover household
  composition, employment, residence history, childcare plan, discipline philosophy,
  references. Put a `citation` on every block, `verified: false` where unsourced.

### Phase 1 — 50 min: the interview room

- Route: `/interview/[token]` — public, no auth, validates token and expiry.
- Consent screen gate before microphone access.
- `components/interview/InterviewRoom.tsx`: camera preview, current question, live
  transcript pane, progress indicator, voice/text toggle.
- `lib/voice.ts`: the `VoiceTransport` interface plus the Web Speech implementation
  and the text implementation.
- `lib/interview-machine.ts`: deterministic state machine over script blocks. This
  owns question sequencing. **The LLM does not control flow.**
- `POST /api/interview/[token]/turn`: persist each turn as it happens. If the browser
  crashes at question 7, the session resumes.

### Phase 2 — 45 min: turn logic

- `POST /api/interview/[token]/respond`: given the current block and the subject's
  utterance, Claude returns strict JSON:

```json
{
  "facts": [{ "fact_id": "household_size", "value": "4", "verbatim": "there's four of us" }],
  "needs_clarification": false,
  "clarifying_question": null,
  "acknowledgment": "Got it, thank you."
}
```

- Enforce `followup_policy` in code, not in the prompt: at most one clarification per
  block, then advance regardless. A model that loops on a question is a stuck demo.
- Reject any response containing a fact id not in the block's `target_facts`.

### Phase 3 — 40 min: draft and review

- `/app/cases/[caseId]/interviews/[sessionId]`: caseworker review surface.
- Two panes: extracted fields on the left, verbatim transcript on the right. Clicking
  a field scrolls the transcript to the utterance that produced it and highlights it.
- Per-field Accept / Edit. Nothing is committed until accepted.
- Big unmissable `DRAFT — NOT REVIEWED` banner until every required field is accepted.

### Phase 4 — 25 min: wire into the graph

- `lib/workflow-model.ts` is the existing seam. Accepted interview facts satisfy
  `GraphNode.inputs[]` entries where `kind === "fact"`.
- Run accepted interview facts through consistency checks alongside document facts.
- The interview node in the graph goes `available → in_progress → verified`, or
  `defect` if an interview fact contradicts a document fact.

### Reserve — 10 min

Demo data: one case, three household members, three sessions. One clean, one with a
clarification loop, one whose answer contradicts an uploaded document.

---

## 7. Scaffolding prompt

Paste this first.

```
Read CLAUDE.md and docs/handoff-*.md for repo context before writing anything.

Build the scaffolding for an AI intake interview agent. Work only in /app,
/components, /lib, /extraction, /demo. Do not touch /ontology or /engines.

Stack constraints, do not deviate:
- Next.js 16 App Router, React 19, TypeScript
- Tailwind v4, shadcn on Base UI (@base-ui/react, NOT Radix). Select.onValueChange
  yields string | null. cn imports from the "cn" package.
- Supabase via @supabase/ssr. Every new table gets RLS keyed to the parent case's
  owner_user_id.
- Zod 4 for all validation.

Build in this order and stop after each numbered item so I can verify:

1. supabase/migrations/0002_interviews.sql
   Tables: interview_sessions, interview_turns, interview_facts.
   interview_sessions: id, case_id FK, subject_name, subject_role, script_id, status
   enum, link_token unique, expires_at, created_at, completed_at.
   interview_turns: id, session_id FK, index, speaker enum, text, started_at, ended_at.
   interview_facts: id, session_id FK, fact_id, value, verbatim, block_id, turn_index,
   accepted boolean default false, accepted_at, accepted_by.
   RLS on all three via a join to cases.owner_user_id = auth.uid().

2. lib/types.ts additions
   InterviewScript, InterviewBlock, InterviewSession, InterviewTurn, FactProvenance as
   a discriminated union on "source" with "document" and "interview" variants. Zod
   schemas alongside each type.

3. extraction/interviews/household-adult.json
   9 blocks. Each: id, prompt (verbatim question text), target_facts (array of fact
   ids), required, followup_policy ("clarify_once" | "none"), citation
   { text, url, retrieved } and verified: false.
   Cover: household composition, adults in home, employment, residence history over
   5 years, childcare plan, discipline philosophy, experience with children, personal
   references, anything else the subject wants on record.
   Do NOT invent citations. Use "PLACEHOLDER" text with verified: false.

4. lib/voice.ts
   VoiceTransport interface: speak(text), listen(), stop().
   WebSpeechTransport using SpeechRecognition + SpeechSynthesis.
   TextTransport that resolves from a text input instead.
   Feature-detect and export a factory that falls back to text automatically.

5. lib/interview-machine.ts
   Deterministic state machine over script blocks. Owns sequencing: current block,
   advance, clarification counter capped by followup_policy, completion detection.
   No LLM calls in this file. Pure function of state plus events, fully unit-testable.

After item 5, stop. Do not build UI or API routes yet.
```

## 8. Handoff prompt

Paste after scaffolding verifies.

```
Continue the interview agent. Same path ownership rules.

6. Public interview route: app/interview/[token]/page.tsx
   No auth. Validate token and expiry server-side; expired or unknown token renders a
   plain "This link is no longer valid" page.
   Consent gate before microphone access, stating: audio is transcribed, a licensed
   caseworker reviews everything, this interview does not make any decision about the
   placement. Explicit Continue button.

7. components/interview/InterviewRoom.tsx
   Camera preview via getUserMedia, video displayed but NEVER recorded or uploaded.
   Current question displayed as text while spoken. Live transcript pane. Progress
   indicator. Voice/text toggle always visible.
   Parent container needs a definite height, not a percentage on a flex child.

8. API routes
   POST /api/interview/[token]/turn   persist a turn immediately on completion
   POST /api/interview/[token]/respond given current block + utterance, call Claude,
     return strict JSON: { facts: [{fact_id, value, verbatim}], needs_clarification,
     clarifying_question, acknowledgment }
   POST /api/interview/[token]/complete mark session complete

   HARD CONSTRAINTS on /respond:
   - The model NEVER chooses the next question. Sequencing is interview-machine.ts.
   - Reject and drop any returned fact_id not in the current block's target_facts.
   - Cap clarifications per block per followup_policy, in code not in the prompt.
   - The model NEVER scores, rates, evaluates, or characterizes the subject. The
     system prompt must state this explicitly and the response schema must have no
     field capable of carrying an assessment.
   - ANTHROPIC_API_KEY from .env.local. Never commit it.

9. Caseworker review: app/cases/[caseId]/interviews/[sessionId]/page.tsx
   Two panes. Left: extracted fields, each with value, target fact id, and Accept /
   Edit. Right: verbatim transcript. Clicking a field scrolls the transcript to the
   producing utterance and highlights it.
   Persistent "DRAFT — NOT REVIEWED" banner until all required fields are accepted.
   Nothing writes to the case fact store until accepted.

10. Deploy action on the case page
    "Send AI Intern" button. Modal: subject name, role in household, script.
    Creates a session, mints link_token with a 7-day expiry, shows a copyable URL.
    Label the button and the session with the caseworker's first name, e.g.
    "Sarah's AI Intern".

11. Graph integration in lib/workflow-model.ts
    Accepted interview facts satisfy GraphNode.inputs[] entries where kind === "fact".
    Interview facts flow into consistency checking alongside document facts; a
    contradiction between an interview fact and a document fact is a normal Defect
    with both sides named in conflicting[].

12. Demo fixtures in /demo
    One case, three household members. Session A completes cleanly. Session B triggers
    one clarification. Session C produces a household_size that contradicts the
    dependent count on an uploaded tax return, surfacing a defect on the graph.

Verify after each item: npm run build must pass, and the app must run end-to-end on at
least one session before moving on.
```

---

## 9. Demo beat

Caseworker opens an interstate case with three adults in the household in another
state. Clicks **Send AI Intern**, generates three links. Cut to a household member's
view: consent, camera on, scripted questions, spoken answers. Cut back to the
caseworker: draft fields on the left, verbatim transcript on the right, click a field
and the transcript jumps to the sentence that produced it. Accept a few. Then the
contradiction fires: the interview says four people live in the home, the tax return
claims three dependents, both sources named. Caseworker resolves it. Graph node turns
verified and the next node unlocks.

Close on the line: the agent gathered; the caseworker decided.

---

## 10. Things that will bite you

1. `SpeechRecognition` is `webkitSpeechRecognition` in Chrome and absent in Safari.
   Feature-detect and fall back to text silently; never let the room render broken.
2. `SpeechSynthesis` on Chrome cancels queued utterances if you call `speak()` before
   the previous finishes. Await completion via the `end` event.
3. Microphone permission fails hard on `http://` origins other than localhost. Test on
   the deployed HTTPS alias before demo day.
4. Persist every turn as it completes. A session lost at question 8 with nothing saved
   is unrecoverable.
5. Claude will occasionally return prose around the JSON. Strip fences and parse
   defensively; on parse failure, treat it as "no facts extracted" and advance rather
   than crashing the room.
6. Keep the script to 9 blocks. A long interview is a worse demo and a worse product.
