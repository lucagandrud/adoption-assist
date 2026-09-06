import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const StateCodeSchema = z.string().min(2);
export const DirectionSchema = z.enum(["sending", "receiving", "both"]);
export const SeveritySchema = z.enum(["blocking", "warning", "info"]);

export const CitationSchema = z.object({
  text: z.string().min(1),
  url: z.string().url().nullable().optional().default(null),
  page_or_section: z.string().nullable().optional(),
  retrieved: z.iso.date().nullable().optional().default(null),
});

export const ProvenanceSchema = z
  .object({
    source_kind: z.enum(["document", "manual"]),
    document_id: z.string().min(1).nullable().optional(),
    document_name: z.string().min(1).nullable().optional(),
    page: z.number().int().positive().nullable().optional(),
    field: z.string().min(1).nullable().optional(),
    extracted_at: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    if (value.source_kind === "document" && !value.document_id) {
      context.addIssue({
        code: "custom",
        path: ["document_id"],
        message: "document provenance requires document_id",
      });
    }
  });

export const FactSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  value: z.unknown(),
  provenance: z.array(ProvenanceSchema).min(1),
  confidence: z.number().min(0).max(1),
  extracted_at: z.iso.datetime(),
});

export const FactTypeDefinitionSchema = z.object({
  value_type: z.enum([
    "address",
    "boolean",
    "date",
    "integer",
    "money",
    "number",
    "string",
  ]),
  source: z.enum(["extracted", "attested", "derived"]),
  unit: z.string().optional(),
  enum: z.array(z.string()).optional(),
  derivation: z.string().optional(),
  note: z.string().optional(),
});

export const FactTypeRegistrySchema = z.object({
  _note: z.string().optional(),
  source_key_meaning: z.string().optional(),
  open_items_for_whoever_builds_the_extraction_pipeline: z
    .array(z.string())
    .optional()
    .default([]),
  facts: z.record(z.string(), FactTypeDefinitionSchema),
});

export const DocumentDefinitionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  states_accepted: z.array(StateCodeSchema).min(1),
  issue_date: z.iso.date().nullable().optional(),
  validity_period_days: z.number().int().nonnegative().nullable(),
  external_turnaround_days: z.number().int().nonnegative().nullable(),
  yields_facts: z.array(z.string().min(1)),
  source_citation: CitationSchema,
  verified: z.boolean(),
  note: z.string().optional(),
});

export const RequirementSchema = z.object({
  id: z.string().min(1),
  state: StateCodeSchema,
  direction: DirectionSchema,
  applies_to: z.array(z.string().min(1)).min(1),
  satisfied_by_documents: z.array(z.string().min(1)),
  satisfied_by_facts: z.array(z.string().min(1)),
  depends_on: z.array(z.string().min(1)),
  source_citation: CitationSchema,
  verified: z.boolean(),
  equivalence_key: z.string().min(1).optional(),
  dependency_rationale: z.string().min(1).optional(),
});

export const SUPPORTED_RULE_EXPRESSIONS = [
  "addresses_match",
  "names_match",
  "household_size_consistent",
  "bedrooms_support_child_count",
] as const;

export const ConsistencyRuleSchema = z.object({
  id: z.string().min(1),
  expression: z.enum(SUPPORTED_RULE_EXPRESSIONS),
  facts_involved: z.array(z.string().min(1)).min(1),
  severity: SeveritySchema,
  defect_message: z.string().min(1),
  source_citation: CitationSchema,
  verified: z.boolean().optional().default(false),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const ActionSchema = z.object({
  id: z.string().min(1),
  verb: z.string().min(1),
  applies_to: z.enum(["requirement", "document", "fact"]),
  preconditions: z.array(z.string().min(1)),
  effects: z.array(z.string().min(1)),
  requires_note: z.boolean(),
});

export const ActionEventSchema = z.object({
  id: z.string().min(1),
  action_id: z.string().min(1),
  target_id: z.string().min(1),
  actor: z.string().min(1),
  note: z.string().optional(),
  occurred_at: z.iso.datetime(),
  prior_state: z.unknown(),
  next_state: z.unknown(),
});

export type StateCode = z.infer<typeof StateCodeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type FactTypeDefinition = z.infer<typeof FactTypeDefinitionSchema>;
export type DocumentDefinition = z.infer<typeof DocumentDefinitionSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type ConsistencyRule = z.infer<typeof ConsistencyRuleSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ActionEvent = z.infer<typeof ActionEventSchema>;

export interface LoadedOntology {
  factTypes: Record<string, FactTypeDefinition>;
  documents: DocumentDefinition[];
  requirements: Requirement[];
  rules: ConsistencyRule[];
  actions: Action[];
  unverifiedIds: string[];
  dataQualityWarnings: string[];
}

function jsonFilesUnder(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(root, entry.name);
      return entry.isDirectory()
        ? jsonFilesUnder(fullPath)
        : entry.isFile() && entry.name.endsWith(".json")
          ? [fullPath]
          : [];
    })
    .sort();
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to parse ontology file ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertUniqueIds<T extends { id: string }>(kind: string, entries: T[]) {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) throw new Error(`Duplicate ${kind} id: ${entry.id}`);
    seen.add(entry.id);
  }
}

function assertAcyclic(requirements: Requirement[]) {
  const dependencies = new Map(
    requirements.map((requirement) => [requirement.id, requirement.depends_on]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string, trail: string[]) => {
    if (visiting.has(id)) {
      throw new Error(`Requirement dependency cycle: ${[...trail, id].join(" -> ")}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      visit(dependency, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const requirement of requirements) visit(requirement.id, []);
}

function validateReferences(ontology: LoadedOntology) {
  const requirementIds = new Set(ontology.requirements.map(({ id }) => id));
  const documentIds = new Set(ontology.documents.map(({ id }) => id));
  const factTypeIds = new Set(Object.keys(ontology.factTypes));

  for (const requirement of ontology.requirements) {
    for (const dependency of requirement.depends_on) {
      if (!requirementIds.has(dependency)) {
        throw new Error(`${requirement.id} depends on missing requirement ${dependency}`);
      }
    }
    for (const documentId of requirement.satisfied_by_documents) {
      if (!documentIds.has(documentId)) {
        throw new Error(`${requirement.id} references missing document ${documentId}`);
      }
    }
    for (const factType of requirement.satisfied_by_facts) {
      if (!factTypeIds.has(factType)) {
        throw new Error(`${requirement.id} references missing fact type ${factType}`);
      }
    }
  }

  for (const document of ontology.documents) {
    for (const factType of document.yields_facts) {
      if (!factTypeIds.has(factType)) {
        throw new Error(`${document.id} yields missing fact type ${factType}`);
      }
    }
  }

  for (const rule of ontology.rules) {
    for (const factType of rule.facts_involved) {
      if (!factTypeIds.has(factType)) {
        throw new Error(`${rule.id} references missing fact type ${factType}`);
      }
    }
  }
  assertAcyclic(ontology.requirements);
}

let cached: LoadedOntology | undefined;

export function loadOntology(
  ontologyRoot = path.join(process.cwd(), "ontology"),
): LoadedOntology {
  const useCache = ontologyRoot === path.join(process.cwd(), "ontology");
  if (useCache && cached) return cached;

  let registry: z.infer<typeof FactTypeRegistrySchema> | undefined;
  const documents: DocumentDefinition[] = [];
  const requirements: Requirement[] = [];
  const rules: ConsistencyRule[] = [];
  const actions: Action[] = [];

  for (const file of jsonFilesUnder(ontologyRoot)) {
    const relative = path.relative(ontologyRoot, file);
    const raw = readJson(file);
    try {
      if (relative === path.join("shared", "fact-types.json")) {
        registry = FactTypeRegistrySchema.parse(raw);
      } else if (relative.includes(`${path.sep}documents${path.sep}`)) {
        documents.push(...z.array(DocumentDefinitionSchema).parse(raw));
      } else if (relative.includes(`${path.sep}requirements${path.sep}`)) {
        requirements.push(...z.array(RequirementSchema).parse(raw));
      } else if (relative.includes(`${path.sep}rules${path.sep}`)) {
        rules.push(...z.array(ConsistencyRuleSchema).parse(raw));
      } else if (relative.includes(`${path.sep}actions${path.sep}`)) {
        actions.push(...z.array(ActionSchema).parse(raw));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid ontology file ${relative}: ${z.prettifyError(error)}`);
      }
      throw error;
    }
  }

  if (!registry) throw new Error("Missing ontology/shared/fact-types.json");
  assertUniqueIds("document", documents);
  assertUniqueIds("requirement", requirements);
  assertUniqueIds("rule", rules);
  assertUniqueIds("action", actions);

  const referencedDocuments = new Set(
    requirements.flatMap((requirement) => requirement.satisfied_by_documents),
  );
  const dataQualityWarnings = documents
    .filter(
      (document) =>
        referencedDocuments.has(document.id) &&
        document.external_turnaround_days === null,
    )
    .map(
      (document) =>
        `${document.id} has unknown external_turnaround_days; graph duration uses 0`,
    );

  const ontology: LoadedOntology = {
    factTypes: registry.facts,
    documents,
    requirements,
    rules,
    actions,
    unverifiedIds: [
      ...requirements.filter(({ verified }) => !verified).map(({ id }) => id),
      ...documents.filter(({ verified }) => !verified).map(({ id }) => id),
      ...rules.filter(({ verified }) => !verified).map(({ id }) => id),
    ].sort(),
    dataQualityWarnings,
  };

  validateReferences(ontology);
  if (useCache) cached = ontology;
  return ontology;
}

export function resetOntologyCache() {
  cached = undefined;
}
