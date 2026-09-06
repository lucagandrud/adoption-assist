/**
 * THE SWAP POINT (handoff-frontend.md, Step 6).
 *
 * This module is the server-side integration boundary. The dashboard stays
 * coupled only to GraphModel while the deterministic engine owns selection,
 * dependency edges, node state, and critical-path math.
 */

import { runConsistencyChecks } from "@/engines/consistency";
import { computeDelta } from "@/engines/delta";
import {
  buildGraphModel,
  selectApplicableRequirements,
} from "@/engines/graph";
import { computeValidity } from "@/engines/validity";
import { findCase, listCaseDocuments } from "@/lib/store";
import type { CaseRecord, GraphModel } from "@/lib/types";
import { FactSchema, loadOntology } from "@/ontology/schema";

export async function graphModelForCase(record: CaseRecord): Promise<GraphModel> {
  const ontology = loadOntology();
  const evidence = await listCaseDocuments(record.owner_user_id, record.id);
  const facts = FactSchema.array().parse(evidence.flatMap(({ facts }) => facts));
  const defects = runConsistencyChecks(facts, ontology.rules, ontology);
  const selectedRequirements = selectApplicableRequirements(
    ontology,
    record.sending_state,
    record.receiving_state,
    record.relationship,
  );
  const factById = new Map(facts.map((fact) => [fact.id, fact]));
  const documentsById = new Map(
    ontology.documents.map((document) => [document.id, document]),
  );
  const defectsByRequirement = Object.fromEntries(
    selectedRequirements.map((requirement) => {
      const acceptedFactTypes = new Set([
        ...requirement.satisfied_by_facts,
        ...requirement.satisfied_by_documents.flatMap(
          (id) => documentsById.get(id)?.yields_facts ?? [],
        ),
      ]);
      const requirementDefects = defects.filter((defect) =>
        defect.conflicting.some((source) => {
          const fact = factById.get(source.fact_id);
          return (
            requirement.satisfied_by_documents.includes(source.document_id) ||
            (fact ? acceptedFactTypes.has(fact.type) : false)
          );
        }),
      );
      return [requirement.id, requirementDefects];
    }),
  );

  const model = buildGraphModel(ontology, {
    id: record.id,
    label: record.label,
    sending_state: record.sending_state,
    receiving_state: record.receiving_state,
    profile: {
      relationship: record.relationship,
      children_count: record.children_count,
      placement_type: record.placement_type,
    },
    window_start: record.window_start,
    provided_document_ids: evidence.map(({ definition_id }) => definition_id),
    facts,
    defects_by_requirement: defectsByRequirement,
  });

  const validity = computeValidity(
    evidence.map((document) => ({
      id: document.id,
      document_id: document.definition_id,
      document_name: document.file_name,
      issue_date: document.issue_date,
    })),
    ontology,
    record.window_start,
    model.case.projected_decision,
  );
  const delta = computeDelta(
    ontology,
    record.sending_state,
    record.receiving_state,
    record.relationship,
  );

  return {
    ...model,
    validity,
    delta: {
      surprise_count: delta.surprise_count,
      total_items: delta.items.length,
      inferred_match_count: delta.items.filter(
        ({ match_confidence }) => match_confidence === "inferred",
      ).length,
    },
    data_quality: {
      unknown_turnaround_count: ontology.dataQualityWarnings.length,
      warnings: ontology.dataQualityWarnings,
    },
  };
}

export async function loadGraphModel(
  userId: string,
  caseId: string,
): Promise<GraphModel | null> {
  const record = await findCase(userId, caseId);
  return record ? await graphModelForCase(record) : null;
}
