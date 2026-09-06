import type { DocumentDefinition, LoadedOntology } from "../ontology/schema.ts";

const DAY_MS = 86_400_000;

export type ValidityState = "valid" | "at_risk" | "expired" | "unknown";

export interface ProvidedDocument {
  id: string;
  document_id: string;
  document_name?: string;
  issue_date?: string | null;
}

export interface ValidityStatus {
  document_id: string;
  definition_id: string;
  document_name: string;
  issue_date: string | null;
  expires_on: string | null;
  days_remaining: number | null;
  state: ValidityState;
  renew_by: string | null;
  lapses_on_day: number | null;
  renewal_is_late: boolean;
}

export interface ValidityReport {
  window_start: string;
  window_end: string;
  projected_decision: string;
  items: ValidityStatus[];
  at_risk_count: number;
}

function dateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Expected YYYY-MM-DD date, received ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function addCalendarDays(value: string, days: number): string {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calendarDaysBetween(from: string, to: string): number {
  return Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / DAY_MS);
}

function humanize(value: string): string {
  return value
    .replace(/^doc-/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function definitionFor(
  provided: ProvidedDocument,
  ontology: LoadedOntology,
): DocumentDefinition {
  const definition = ontology.documents.find(({ id }) => id === provided.document_id);
  if (!definition) {
    throw new Error(
      `Provided document ${provided.id} references unknown definition ${provided.document_id}`,
    );
  }
  return definition;
}

export function computeValidity(
  providedDocuments: ProvidedDocument[],
  ontology: LoadedOntology,
  windowStart: string,
  projectedDecision: string,
  today = new Date().toISOString().slice(0, 10),
): ValidityReport {
  dateOnly(windowStart);
  dateOnly(projectedDecision);
  dateOnly(today);

  const items = providedDocuments.map((provided): ValidityStatus => {
    const definition = definitionFor(provided, ontology);
    const documentName = provided.document_name ?? humanize(definition.type);
    const issueDate = provided.issue_date ?? definition.issue_date ?? null;

    if (definition.validity_period_days === null) {
      return {
        document_id: provided.id,
        definition_id: provided.document_id,
        document_name: documentName,
        issue_date: issueDate,
        expires_on: null,
        days_remaining: null,
        state: "valid",
        renew_by: null,
        lapses_on_day: null,
        renewal_is_late: false,
      };
    }

    if (!issueDate) {
      return {
        document_id: provided.id,
        definition_id: provided.document_id,
        document_name: documentName,
        issue_date: null,
        expires_on: null,
        days_remaining: null,
        state: "unknown",
        renew_by: null,
        lapses_on_day: null,
        renewal_is_late: false,
      };
    }

    const expiresOn = addCalendarDays(issueDate, definition.validity_period_days);
    const daysRemaining = calendarDaysBetween(today, expiresOn);
    const state: ValidityState =
      expiresOn < today
        ? "expired"
        : expiresOn < projectedDecision
          ? "at_risk"
          : "valid";
    const needsRenewal = state === "expired" || state === "at_risk";
    const renewBy = needsRenewal
      ? addCalendarDays(
          expiresOn,
          -(definition.external_turnaround_days ?? 0),
        )
      : null;

    return {
      document_id: provided.id,
      definition_id: provided.document_id,
      document_name: documentName,
      issue_date: issueDate,
      expires_on: expiresOn,
      days_remaining: daysRemaining,
      state,
      renew_by: renewBy,
      lapses_on_day: needsRenewal
        ? calendarDaysBetween(windowStart, expiresOn)
        : null,
      renewal_is_late: renewBy !== null && renewBy < today,
    };
  });

  return {
    window_start: windowStart,
    window_end: addCalendarDays(windowStart, 180),
    projected_decision: projectedDecision,
    items,
    at_risk_count: items.filter(
      ({ state }) => state === "at_risk" || state === "expired",
    ).length,
  };
}
