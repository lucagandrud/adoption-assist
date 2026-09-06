/**
 * The authored interview scripts, validated on import.
 *
 * A script that fails validation throws at module load, so a malformed
 * question file is a build/boot failure rather than a subject halfway through
 * an interview hitting a blank prompt. Same posture as the ontology loader.
 *
 * Safe to import from client and server: the scripts are public data with
 * nothing in them but the questions every subject is asked.
 */

import householdAdult from "@/extraction/interviews/household-adult.json";
import { interviewScriptSchema } from "@/lib/interview-schemas";
import type { InterviewScript } from "@/lib/types";

function load(raw: unknown, file: string): InterviewScript {
  const parsed = interviewScriptSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Interview script ${file} failed validation:\n` +
        parsed.error.issues
          .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("\n"),
    );
  }
  return parsed.data;
}

export const INTERVIEW_SCRIPTS: InterviewScript[] = [
  load(householdAdult, "extraction/interviews/household-adult.json"),
];

export function getScript(id: string): InterviewScript | null {
  return INTERVIEW_SCRIPTS.find((s) => s.id === id) ?? null;
}

export function requireScript(id: string): InterviewScript {
  const script = getScript(id);
  if (!script) throw new Error(`Unknown interview script: ${id}`);
  return script;
}

export const DEFAULT_SCRIPT_ID = INTERVIEW_SCRIPTS[0].id;
