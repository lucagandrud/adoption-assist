/**
 * Input validation. Zod guards every write path — the same library that
 * validates the ontology at boot (/ontology/schema.ts) validates form input,
 * so a malformed case can never reach the store.
 */

import { z } from "zod";
import { JURISDICTION_CODES } from "@/lib/states";

const jurisdiction = z
  .string()
  .refine((code) => JURISDICTION_CODES.includes(code), {
    message: "Select a US state or the District of Columbia.",
  });

export const signInSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.email("Enter a valid work email address."),
  agency: z.string().trim().max(120).optional().default(""),
});

export const caseSchema = z
  .object({
    label: z.string().trim().min(3, "Give the case a label."),
    sending_state: jurisdiction,
    receiving_state: jurisdiction,
    relationship: z.enum(["parent", "relative", "fictive_kin", "non_relative"]),
    children_count: z.coerce.number<number>().int().min(1).max(12),
    placement_type: z.enum(["foster", "adoption", "parent", "residential"]),
    window_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  })
  .refine((v) => v.sending_state !== v.receiving_state, {
    message: "Sending and receiving states must differ — ICPC is interstate.",
    path: ["receiving_state"],
  });

export const casePatchSchema = z.object({
  sending_state: jurisdiction.optional(),
  receiving_state: jurisdiction.optional(),
  label: z.string().trim().min(3).optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type CaseInputValidated = z.infer<typeof caseSchema>;

/** Flattens a ZodError into { field: message } for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
