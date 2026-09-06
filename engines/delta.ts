import type {
  Citation,
  DocumentDefinition,
  LoadedOntology,
  Requirement,
} from "../ontology/schema.ts";

export type DeltaKind =
  | "only_in_receiving"
  | "only_in_sending"
  | "stricter_threshold"
  | "different_form"
  | "equivalent";

export interface ThresholdDelta {
  field: string;
  from: number;
  to: number;
}

export interface DeltaItem {
  kind: DeltaKind;
  sending_requirement: Requirement | null;
  receiving_requirement: Requirement | null;
  explanation: string;
  threshold_delta: ThresholdDelta | null;
  citations: Citation[];
  verified: boolean;
  match_confidence: "authored" | "inferred" | "none";
}

export interface DeltaReport {
  sending_state: string;
  receiving_state: string;
  items: DeltaItem[];
  surprise_count: number;
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  return [...left].some((value) => right.has(value));
}

function requirementDocumentTypes(
  requirement: Requirement,
  documents: Map<string, DocumentDefinition>,
): Set<string> {
  return new Set(
    requirement.satisfied_by_documents
      .map((id) => documents.get(id)?.type)
      .filter((value): value is string => Boolean(value)),
  );
}

function similarity(
  left: Requirement,
  right: Requirement,
  documents: Map<string, DocumentDefinition>,
): number {
  if (
    left.equivalence_key &&
    right.equivalence_key &&
    left.equivalence_key === right.equivalence_key
  ) {
    return 100;
  }
  const leftFacts = new Set(left.satisfied_by_facts);
  const rightFacts = new Set(right.satisfied_by_facts);
  const leftTypes = requirementDocumentTypes(left, documents);
  const rightTypes = requirementDocumentTypes(right, documents);
  let score = 0;
  if (leftFacts.size > 0 && intersects(leftFacts, rightFacts)) score += 2;
  if (leftTypes.size > 0 && intersects(leftTypes, rightTypes)) score += 1;
  return score;
}

function validityFloor(
  requirement: Requirement,
  documents: Map<string, DocumentDefinition>,
): number | null {
  const periods = requirement.satisfied_by_documents
    .map((id) => documents.get(id)?.validity_period_days)
    .filter((value): value is number => typeof value === "number");
  return periods.length > 0 ? Math.min(...periods) : null;
}

function classifyPair(
  sending: Requirement,
  receiving: Requirement,
  documents: Map<string, DocumentDefinition>,
  confidence: "authored" | "inferred",
): DeltaItem {
  const sendingValidity = validityFloor(sending, documents);
  const receivingValidity = validityFloor(receiving, documents);
  const sendingTypes = requirementDocumentTypes(sending, documents);
  const receivingTypes = requirementDocumentTypes(receiving, documents);

  let kind: DeltaKind = "equivalent";
  let thresholdDelta: ThresholdDelta | null = null;
  let explanation = "Matched administrative obligations have no encoded tightening.";

  if (
    sendingValidity !== null &&
    receivingValidity !== null &&
    receivingValidity < sendingValidity
  ) {
    kind = "stricter_threshold";
    thresholdDelta = {
      field: "validity_period_days",
      from: sendingValidity,
      to: receivingValidity,
    };
    explanation = `The receiving-side document validity period is ${receivingValidity} days instead of ${sendingValidity} days.`;
  } else if (
    sendingTypes.size > 0 &&
    receivingTypes.size > 0 &&
    !intersects(sendingTypes, receivingTypes)
  ) {
    kind = "different_form";
    explanation = "The matched obligation is supported by different document types.";
  }

  return {
    kind,
    sending_requirement: sending,
    receiving_requirement: receiving,
    explanation,
    threshold_delta: thresholdDelta,
    citations: [sending.source_citation, receiving.source_citation],
    verified: sending.verified && receiving.verified,
    match_confidence: confidence,
  };
}

const kindRank: Record<DeltaKind, number> = {
  only_in_receiving: 0,
  stricter_threshold: 1,
  different_form: 2,
  only_in_sending: 3,
  equivalent: 4,
};

export function computeDelta(
  ontology: LoadedOntology,
  sendingState: string,
  receivingState: string,
  relationship: string,
): DeltaReport {
  const applies = (requirement: Requirement) =>
    requirement.applies_to.includes(relationship) ||
    requirement.applies_to.includes("general");
  const sending = ontology.requirements.filter(
    (requirement) =>
      requirement.state === sendingState &&
      requirement.direction === "sending" &&
      applies(requirement),
  );
  const receiving = ontology.requirements.filter(
    (requirement) =>
      requirement.state === receivingState &&
      requirement.direction === "receiving" &&
      applies(requirement),
  );
  const documents = new Map(
    ontology.documents.map((document) => [document.id, document]),
  );
  const unmatchedReceiving = new Set(receiving.map(({ id }) => id));
  const items: DeltaItem[] = [];

  for (const sendingRequirement of sending) {
    const candidates = receiving
      .filter(({ id }) => unmatchedReceiving.has(id))
      .map((receivingRequirement) => ({
        requirement: receivingRequirement,
        score: similarity(sendingRequirement, receivingRequirement, documents),
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.requirement.id.localeCompare(right.requirement.id),
      );
    const match = candidates[0];
    if (!match) {
      items.push({
        kind: "only_in_sending",
        sending_requirement: sendingRequirement,
        receiving_requirement: null,
        explanation: "No receiving-side equivalent is encoded.",
        threshold_delta: null,
        citations: [sendingRequirement.source_citation],
        verified: sendingRequirement.verified,
        match_confidence: "none",
      });
      continue;
    }

    unmatchedReceiving.delete(match.requirement.id);
    const confidence =
      match.score === 100 ? ("authored" as const) : ("inferred" as const);
    items.push(
      classifyPair(
        sendingRequirement,
        match.requirement,
        documents,
        confidence,
      ),
    );
  }

  for (const receivingRequirement of receiving) {
    if (!unmatchedReceiving.has(receivingRequirement.id)) continue;
    items.push({
      kind: "only_in_receiving",
      sending_requirement: null,
      receiving_requirement: receivingRequirement,
      explanation: "No sending-side equivalent is encoded.",
      threshold_delta: null,
      citations: [receivingRequirement.source_citation],
      verified: receivingRequirement.verified,
      match_confidence: "none",
    });
  }

  items.sort(
    (left, right) =>
      kindRank[left.kind] - kindRank[right.kind] ||
      (left.receiving_requirement?.id ?? left.sending_requirement?.id ?? "").localeCompare(
        right.receiving_requirement?.id ?? right.sending_requirement?.id ?? "",
      ),
  );

  return {
    sending_state: sendingState,
    receiving_state: receivingState,
    items,
    surprise_count: items.filter(({ kind }) => kind === "only_in_receiving").length,
  };
}
