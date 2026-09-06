import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  FactSchema,
  type DocumentDefinition,
  type Fact,
  type LoadedOntology,
} from "../ontology/schema.ts";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export interface UploadMetadata {
  name: string;
  type: string;
  size: number;
}

export interface ExtractionResult {
  document: DocumentDefinition;
  facts: Fact[];
  mode: "synthetic_cache" | "live_anthropic";
  warnings: string[];
}

export type DemoVariant = "consistent" | "conflicting";

const ExtractedValueSchema = z.object({
  type: z.string().min(1),
  value: z.unknown().nullable(),
  page: z.number().int().positive(),
  field: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

function humanize(value: string): string {
  return value
    .replace(/^fact\./, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validateUpload(file: UploadMetadata) {
  if (!file.name.trim()) throw new Error("The uploaded file needs a name.");
  if (!ACCEPTED_UPLOAD_TYPES.has(file.type)) {
    throw new Error("Only synthetic PDF, PNG, and JPEG files are accepted.");
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The uploaded file must be between 1 byte and 10 MB.");
  }
}

function syntheticValue(factType: string, variant: DemoVariant): unknown {
  const conflicting = variant === "conflicting";
  const values: Record<string, unknown> = {
    "fact.person.legal_name": conflicting ? "Maria Rivers" : "Maria Elena Rivera",
    "fact.person.date_of_birth": "1988-04-12",
    "fact.person.marital_status": "married",
    "fact.person.marriage_duration_years": 8,
    "fact.residence.address": conflicting
      ? "88 Cedar Avenue, Sacramento, CA 95818"
      : "1442 Oak Street, Sacramento, CA 95814",
    "fact.residence.lived_out_of_state_within_5_years": false,
    "fact.income.annual_gross": 72_000,
    "fact.household.size": conflicting ? 5 : 4,
    "fact.home.bedroom_count": 2,
    "fact.home.child_count": 2,
    "fact.home.children_per_bedroom": 2,
    "fact.home.has_pool": false,
    "fact.home.each_child_has_own_bed_mattress": true,
    "fact.capacity.total_household": 6,
    "fact.capacity.foster_care": 4,
    "fact.training.general_hours_completed": 12,
    "fact.training.normalcy_hours_completed": 2,
    "fact.relationship.degree_to_child": "grandparent",
  };
  return values[factType] ?? null;
}

/**
 * Offline extraction for the synthetic hackathon demo.
 *
 * The uploaded bytes are deliberately not persisted or interpreted. The
 * declared ontology document type selects a deterministic cached result, so
 * the demo remains reproducible without an API key or network connection.
 */
export function extractSyntheticDocument(
  file: UploadMetadata,
  declaredDocumentId: string,
  ontology: LoadedOntology,
  variant: DemoVariant = "consistent",
): ExtractionResult {
  validateUpload(file);
  const document = ontology.documents.find(({ id }) => id === declaredDocumentId);
  if (!document) throw new Error(`Unknown document type: ${declaredDocumentId}`);

  const extractedAt = new Date().toISOString();
  const warnings: string[] = [];
  const facts = document.yields_facts.flatMap((factType): Fact[] => {
    const definition = ontology.factTypes[factType];
    if (!definition) throw new Error(`${document.id} references unknown fact ${factType}`);
    if (definition.source !== "extracted") {
      warnings.push(
        `${factType} is ${definition.source} and was not synthesized from the document.`,
      );
      return [];
    }
    const value = syntheticValue(factType, variant);
    if (value === null) {
      warnings.push(`${factType} has no cached synthetic value.`);
      return [];
    }
    return [
      FactSchema.parse({
        id: `fact-${randomUUID().slice(0, 8)}`,
        type: factType,
        value,
        provenance: [
          {
            source_kind: "document",
            document_id: document.id,
            document_name: humanize(document.type),
            page: 1,
            field: humanize(factType),
            extracted_at: extractedAt,
          },
        ],
        confidence: 1,
        extracted_at: extractedAt,
      }),
    ];
  });

  return {
    document,
    facts,
    mode: "synthetic_cache",
    warnings,
  };
}

function livePrompt(document: DocumentDefinition): string {
  return `Extract only the requested fields from this synthetic case document.

Allowed fact types: ${JSON.stringify(document.yields_facts)}

Return only a JSON array. Each item must have exactly:
{"type":"one allowed fact type","value":<literal value or null>,"page":<1-based integer>,"field":"printed field label","confidence":<0 to 1>}

Rules:
- Do not infer facts that are absent or illegible; use null.
- Never return a fact type outside the allowed list.
- Preserve dates as YYYY-MM-DD and addresses as printed.
- This is administrative extraction only. Do not assess, approve, deny, score, or characterize the family.`;
}

function parseJsonArray(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Model response did not contain a JSON array.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callAnthropic(
  file: UploadMetadata,
  bytes: Uint8Array,
  document: DocumentDefinition,
): Promise<z.infer<typeof ExtractedValueSchema>[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const mediaBlock = {
    type: file.type === "application/pdf" ? "document" : "image",
    source: {
      type: "base64",
      media_type: file.type,
      data: Buffer.from(bytes).toString("base64"),
    },
  };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [mediaBlock, { type: "text", text: livePrompt(document) }],
        },
      ],
    }),
  });
  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Anthropic request failed (${response.status}).`);
  }
  const text = payload.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
  return z.array(ExtractedValueSchema).parse(parseJsonArray(text ?? ""));
}

export async function extractDocument(
  file: UploadMetadata,
  bytes: Uint8Array | null,
  declaredDocumentId: string,
  ontology: LoadedOntology,
): Promise<ExtractionResult> {
  validateUpload(file);
  const document = ontology.documents.find(({ id }) => id === declaredDocumentId);
  if (!document) throw new Error(`Unknown document type: ${declaredDocumentId}`);
  const useCache = process.env.EXTRACTION_USE_CACHE === "1" || !process.env.ANTHROPIC_API_KEY;
  if (useCache || !bytes) {
    return extractSyntheticDocument(file, declaredDocumentId, ontology, "consistent");
  }

  let extracted: z.infer<typeof ExtractedValueSchema>[] | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      extracted = await callAnthropic(file, bytes, document);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!extracted) {
    throw new Error(
      `Live extraction failed after one retry: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  const allowed = new Set(document.yields_facts);
  const extractedAt = new Date().toISOString();
  const warnings: string[] = [];
  const facts = extracted.flatMap((item): Fact[] => {
    if (!allowed.has(item.type)) {
      warnings.push(`Dropped model-supplied fact outside the document contract: ${item.type}`);
      return [];
    }
    const definition = ontology.factTypes[item.type];
    if (definition.source !== "extracted" || item.value === null) return [];
    return [
      FactSchema.parse({
        id: `fact-${randomUUID().slice(0, 8)}`,
        type: item.type,
        value: item.value,
        provenance: [
          {
            source_kind: "document",
            document_id: document.id,
            document_name: file.name,
            page: item.page,
            field: item.field,
            extracted_at: extractedAt,
          },
        ],
        confidence: item.confidence,
        extracted_at: extractedAt,
      }),
    ];
  });
  return { document, facts, mode: "live_anthropic", warnings };
}
