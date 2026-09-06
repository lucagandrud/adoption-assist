import type { Fact, LoadedOntology, Requirement } from "../ontology/schema.ts";
import type {
  CaseProfile,
  Citation,
  Defect,
  GraphEdge,
  GraphModel,
  GraphNode,
  NodeState,
  RequirementInput,
} from "../lib/types.ts";

const DAY_MS = 86_400_000;

export interface BuildGraphInput {
  id: string;
  label: string;
  sending_state: string;
  receiving_state: string;
  profile: CaseProfile;
  window_start: string;
  provided_document_ids?: Iterable<string>;
  facts?: Fact[];
  verified_requirement_ids?: Iterable<string>;
  defects_by_requirement?: Record<string, Defect[]>;
}

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Expected YYYY-MM-DD date, received ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function addCalendarDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requirementLabel(requirement: Requirement): string {
  const ignored = new Set(["req", "ca", "tx", "federal", "sending", "receiving"]);
  return requirement.id
    .split("-")
    .filter((part) => !ignored.has(part))
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inputLabel(value: string): string {
  return value
    .replace(/^(doc-|fact\.)/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function selectApplicableRequirements(
  ontology: LoadedOntology,
  sendingState: string,
  receivingState: string,
  relationship: string,
): Requirement[] {
  return ontology.requirements
    .filter((requirement) => {
      const applies =
        requirement.applies_to.includes(relationship) ||
        requirement.applies_to.includes("general");
      if (!applies) return false;
      if (requirement.state === "FEDERAL") return true;
      return (
        (requirement.state === sendingState && requirement.direction === "sending") ||
        (requirement.state === receivingState &&
          requirement.direction === "receiving")
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function topologicalOrder(
  requirements: Requirement[],
  dependencies: Map<string, string[]>,
): string[] {
  const indegree = new Map(requirements.map(({ id }) => [id, 0]));
  const successors = new Map<string, string[]>();
  for (const requirement of requirements) {
    const deps = dependencies.get(requirement.id) ?? [];
    indegree.set(requirement.id, deps.length);
    for (const dependency of deps) {
      const next = successors.get(dependency) ?? [];
      next.push(requirement.id);
      successors.set(dependency, next);
    }
  }

  const ready = requirements
    .filter(({ id }) => indegree.get(id) === 0)
    .map(({ id }) => id)
    .sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const successor of (successors.get(id) ?? []).sort()) {
      const remaining = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, remaining);
      if (remaining === 0) {
        ready.push(successor);
        ready.sort();
      }
    }
  }
  if (order.length !== requirements.length) {
    throw new Error("Applicable requirement graph contains a cycle");
  }
  return order;
}

export function buildGraphModel(
  ontology: LoadedOntology,
  input: BuildGraphInput,
): GraphModel {
  const requirements = selectApplicableRequirements(
    ontology,
    input.sending_state,
    input.receiving_state,
    input.profile.relationship,
  );
  const selectedIds = new Set(requirements.map(({ id }) => id));
  const dependencies = new Map(
    requirements.map((requirement) => [
      requirement.id,
      requirement.depends_on.filter((id) => selectedIds.has(id)).sort(),
    ]),
  );
  const order = topologicalOrder(requirements, dependencies);
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const documentsById = new Map(
    ontology.documents.map((document) => [document.id, document]),
  );
  const providedDocuments = new Set(input.provided_document_ids ?? []);
  const facts = input.facts ?? [];
  const providedFactTypes = new Set(
    facts
      .filter(
        (fact) =>
          fact.confidence >= 0.8 &&
          fact.provenance.some(({ source_kind }) => source_kind === "document"),
      )
      .map((fact) => fact.type),
  );
  const explicitlyVerified = new Set(input.verified_requirement_ids ?? []);
  const defectsByRequirement = input.defects_by_requirement ?? {};

  const inputsByRequirement = new Map<string, RequirementInput[]>();
  const allInputsSatisfied = new Map<string, boolean>();
  const anyInputSatisfied = new Map<string, boolean>();
  for (const requirement of requirements) {
    const requirementInputs: RequirementInput[] = [
      ...requirement.satisfied_by_documents.map((id) => ({
        kind: "document" as const,
        id,
        label: documentsById.has(id)
          ? inputLabel(documentsById.get(id)!.type)
          : inputLabel(id),
        satisfied: providedDocuments.has(id),
      })),
      ...requirement.satisfied_by_facts.map((id) => ({
        kind: "fact" as const,
        id,
        label: inputLabel(id),
        satisfied: providedFactTypes.has(id),
      })),
    ];
    inputsByRequirement.set(requirement.id, requirementInputs);
    allInputsSatisfied.set(
      requirement.id,
      requirementInputs.every(({ satisfied }) => satisfied),
    );
    anyInputSatisfied.set(
      requirement.id,
      requirementInputs.some(({ satisfied }) => satisfied),
    );
  }

  const duration = new Map<string, number>();
  for (const requirement of requirements) {
    const complete =
      explicitlyVerified.has(requirement.id) ||
      (allInputsSatisfied.get(requirement.id) &&
        (defectsByRequirement[requirement.id]?.length ?? 0) === 0);
    const turnaround = requirement.satisfied_by_documents.map(
      (id) => documentsById.get(id)?.external_turnaround_days ?? 0,
    );
    duration.set(requirement.id, complete ? 0 : Math.max(0, ...turnaround));
  }

  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();
  for (const id of order) {
    const start = Math.max(
      0,
      ...(dependencies.get(id) ?? []).map(
        (dependency) => earliestFinish.get(dependency) ?? 0,
      ),
    );
    earliestStart.set(id, start);
    earliestFinish.set(id, start + (duration.get(id) ?? 0));
  }
  const projectFinish = Math.max(0, ...earliestFinish.values());

  const successors = new Map<string, string[]>();
  for (const [id, deps] of dependencies) {
    for (const dependency of deps) {
      const next = successors.get(dependency) ?? [];
      next.push(id);
      successors.set(dependency, next);
    }
  }
  const latestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const next = successors.get(id) ?? [];
    const finish =
      next.length === 0
        ? projectFinish
        : Math.min(...next.map((successor) => latestStart.get(successor)!));
    latestFinish.set(id, finish);
    latestStart.set(id, finish - (duration.get(id) ?? 0));
  }

  const criticalPath: string[] = [];
  if (order.length > 0) {
    let current = [...order]
      .filter((id) => (earliestFinish.get(id) ?? 0) === projectFinish)
      .sort()[0];
    while (current) {
      criticalPath.unshift(current);
      const predecessor = (dependencies.get(current) ?? [])
        .filter(
          (id) =>
            (earliestFinish.get(id) ?? 0) ===
              (earliestStart.get(current) ?? 0) &&
            (latestStart.get(id) ?? 0) === (earliestStart.get(id) ?? 0),
        )
        .sort()[0];
      current = predecessor;
    }
  }
  const criticalIds = new Set(criticalPath);

  const stateById = new Map<string, NodeState>();
  for (const id of order) {
    const defects = defectsByRequirement[id] ?? [];
    const predecessorsComplete = (dependencies.get(id) ?? []).every(
      (dependency) => stateById.get(dependency) === "verified",
    );
    let state: NodeState;
    if (defects.length > 0) state = "defect";
    else if (explicitlyVerified.has(id) || allInputsSatisfied.get(id)) {
      state = "verified";
    } else if (!predecessorsComplete) state = "locked";
    else if (anyInputSatisfied.get(id)) state = "in_progress";
    else state = "available";
    stateById.set(id, state);
  }

  const nodes: GraphNode[] = order.map((id) => {
    const requirement = byId.get(id)!;
    return {
      requirement_id: id,
      label: requirementLabel(requirement),
      state: stateById.get(id)!,
      on_critical_path: criticalIds.has(id),
      slack_days:
        (latestStart.get(id) ?? 0) - (earliestStart.get(id) ?? 0),
      earliest_start: addCalendarDays(
        input.window_start,
        earliestStart.get(id) ?? 0,
      ),
      earliest_finish: addCalendarDays(
        input.window_start,
        earliestFinish.get(id) ?? 0,
      ),
      citation: requirement.source_citation as Citation,
      verified: requirement.verified,
      inputs: inputsByRequirement.get(id) ?? [],
      defects: defectsByRequirement[id] ?? [],
    };
  });

  const edges: GraphEdge[] = requirements.flatMap((requirement) =>
    (dependencies.get(requirement.id) ?? []).map((dependency) => ({
      from: dependency,
      to: requirement.id,
    })),
  );

  return {
    case: {
      id: input.id,
      label: input.label,
      sending_state: input.sending_state,
      receiving_state: input.receiving_state,
      direction: `${input.sending_state}_to_${input.receiving_state}`,
      profile: input.profile,
      window_start: input.window_start,
      projected_decision: addCalendarDays(input.window_start, 180),
    },
    earliest_filing: addCalendarDays(input.window_start, projectFinish),
    critical_path: criticalPath,
    nodes,
    edges,
    source: "engine",
  };
}

export const millisecondsPerDay = DAY_MS;
