import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractDocument,
  extractSyntheticDocument,
  liveExtractionConfigured,
} from "@/extraction/pipeline";
import { selectApplicableRequirements } from "@/engines/graph";
import { addCalendarDays } from "@/engines/validity";
import { getSessionUser } from "@/lib/session";
import {
  clearCaseDocuments,
  findCase,
  listCaseDocuments,
  saveCaseDocument,
} from "@/lib/store";
import { loadOntology } from "@/ontology/schema";

type Context = { params: Promise<{ caseId: string }> };

const InputSchema = z.object({
  document_id: z.string().min(1),
  file_name: z.string().min(1).default("synthetic-demo.pdf"),
  mime_type: z.enum(["application/pdf", "image/png", "image/jpeg"]).default(
    "application/pdf",
  ),
  size: z.number().int().positive().max(10 * 1024 * 1024).default(1),
  issue_date: z.iso.date().nullable().optional(),
  variant: z.enum(["consistent", "conflicting"]).default("consistent"),
  demo_file_name: z
    .enum([
      "rfa-application-rivera.pdf",
      "home-safety-assessment-conflict.pdf",
      "home-safety-assessment-corrected.pdf",
      "health-screening-rivera.pdf",
    ])
    .optional(),
  extraction_mode: z.enum(["replay", "live"]).default("replay"),
});

const DEMO_FILES: Record<string, string> = {
  "rfa-application-rivera.pdf": "doc-rfa-application-form-rfa01a",
  "home-safety-assessment-conflict.pdf": "doc-home-health-safety-assessment-report",
  "home-safety-assessment-corrected.pdf": "doc-home-health-safety-assessment-report",
  "health-screening-rivera.pdf": "doc-health-screening-form",
};

function demoDocumentBytes(name: string) {
  return readFile(path.join(process.cwd(), "demo", "documents", name));
}

async function authenticatedCase(context: Context) {
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in." as const, status: 401 as const };
  const { caseId } = await context.params;
  const record = await findCase(user.id, caseId);
  if (!record) return { error: "Case not found." as const, status: 404 as const };
  return { user, record };
}

export async function GET(_request: Request, context: Context) {
  const auth = await authenticatedCase(context);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return NextResponse.json({
    documents: await listCaseDocuments(auth.user.id, auth.record.id),
  });
}

export async function POST(request: Request, context: Context) {
  const auth = await authenticatedCase(context);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let raw: unknown;
  let uploadedFile: File | null = null;
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      uploadedFile = file instanceof File ? file : null;
      raw = {
        document_id: form.get("document_id"),
        variant: form.get("variant") ?? "consistent",
        issue_date: form.get("issue_date") || undefined,
        file_name: file instanceof File ? file.name : "synthetic-demo.pdf",
        mime_type: file instanceof File ? file.type : "application/pdf",
        size: file instanceof File ? file.size : 1,
        extraction_mode: "live",
      };
    } else {
      raw = await request.json();
    }
  } catch {
    return NextResponse.json({ error: "Malformed upload request." }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid synthetic document upload.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    if (uploadedFile && !liveExtractionConfigured()) {
      return NextResponse.json(
        {
          error:
            "Live document reading is not configured. Use a demo replay or ask an administrator to enable live extraction.",
        },
        { status: 503 },
      );
    }
    if (
      parsed.data.demo_file_name &&
      DEMO_FILES[parsed.data.demo_file_name] !== parsed.data.document_id
    ) {
      return NextResponse.json(
        { error: "The selected sample does not match this document type." },
        { status: 422 },
      );
    }
    if (parsed.data.extraction_mode === "live" && !liveExtractionConfigured()) {
      return NextResponse.json(
        { error: "Live extraction is not configured on this deployment." },
        { status: 503 },
      );
    }
    const metadata = {
      name: parsed.data.file_name,
      type: parsed.data.mime_type,
      size: parsed.data.size,
    };
    const demoBytes = parsed.data.demo_file_name
      ? await demoDocumentBytes(parsed.data.demo_file_name)
      : null;
    const result = uploadedFile
      ? await extractDocument(
          metadata,
          new Uint8Array(await uploadedFile.arrayBuffer()),
          parsed.data.document_id,
          loadOntology(),
        )
      : demoBytes && parsed.data.extraction_mode === "live"
        ? await extractDocument(
            { ...metadata, size: demoBytes.byteLength },
            demoBytes,
            parsed.data.document_id,
            loadOntology(),
          )
      : extractSyntheticDocument(
          metadata,
          parsed.data.document_id,
          loadOntology(),
          parsed.data.variant,
        );
    const issueDate =
      parsed.data.issue_date ??
      (result.document.validity_period_days === null
        ? auth.record.window_start
        : addCalendarDays(auth.record.window_start, -300));
    const saved = await saveCaseDocument(auth.user.id, auth.record.id, {
      definition_id: result.document.id,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type,
      issue_date: issueDate,
      extraction_mode: result.mode,
      facts: result.facts,
    });
    if (!saved) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        document: saved,
        warnings: result.warnings,
        run: {
          mode: result.mode,
          model: result.telemetry.model,
          duration_ms: result.telemetry.duration_ms,
          input_tokens: result.telemetry.input_tokens,
          output_tokens: result.telemetry.output_tokens,
          attempts: result.telemetry.attempts,
          facts_extracted: result.facts.length,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed." },
      { status: 422 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await authenticatedCase(context);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await clearCaseDocuments(auth.user.id, auth.record.id);
  return NextResponse.json({ ok: true });
}

/** Load a deterministic, direction-aware demo bundle in one click. */
export async function PUT(request: Request, context: Context) {
  const auth = await authenticatedCase(context);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const requestedMode = new URL(request.url).searchParams.get("mode") ?? "replay";
  if (requestedMode !== "replay" && requestedMode !== "live") {
    return NextResponse.json({ error: "Unknown demo mode." }, { status: 400 });
  }
  if (requestedMode === "live" && !liveExtractionConfigured()) {
    return NextResponse.json(
      { error: "Live extraction is not configured on this deployment." },
      { status: 503 },
    );
  }
  const ontology = loadOntology();
  const requirements = selectApplicableRequirements(
    ontology,
    auth.record.sending_state,
    auth.record.receiving_state,
    auth.record.relationship,
  );
  const selectedDocumentIds = new Set(
    requirements.flatMap(({ satisfied_by_documents }) => satisfied_by_documents),
  );
  const selectedDocuments = ontology.documents.filter(({ id }) =>
    selectedDocumentIds.has(id),
  );
  const rulePriority = [
    "addresses_match",
    "names_match",
    "household_size_consistent",
  ];
  const priorityOf = (expression: string) => {
    const index = rulePriority.indexOf(expression);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const rule = [...ontology.rules].sort(
    (left, right) =>
      priorityOf(left.expression) - priorityOf(right.expression),
  ).find((candidate) => {
    const [factType] = candidate.facts_involved;
    return (
      candidate.facts_involved.length === 1 &&
      selectedDocuments.filter(({ yields_facts }) => yields_facts.includes(factType))
        .length >= 2
    );
  });
  if (!rule) {
    return NextResponse.json(
      { error: "No two-document consistency demo is available for this direction." },
      { status: 422 },
    );
  }

  const documentPriority: Record<string, number> = {
    "doc-rfa-application-form-rfa01a": 0,
    "doc-home-health-safety-assessment-report": 1,
  };
  const [first, second] = selectedDocuments
    .filter(({ yields_facts }) => yields_facts.includes(rule.facts_involved[0]))
    .sort(
      (left, right) =>
        (documentPriority[left.id] ?? 100) - (documentPriority[right.id] ?? 100),
    );
  const expiring = selectedDocuments.find(
    (document) =>
      document.validity_period_days !== null &&
      document.id !== first.id &&
      document.id !== second.id,
  );
  const bundle = [
    { document: first, variant: "consistent" as const },
    { document: second, variant: "conflicting" as const },
    ...(expiring
      ? [{ document: expiring, variant: "consistent" as const }]
      : []),
  ];

  const demoFileNames: Record<string, Record<"consistent" | "conflicting", string>> = {
    "doc-rfa-application-form-rfa01a": {
      consistent: "rfa-application-rivera.pdf",
      conflicting: "rfa-application-rivera.pdf",
    },
    "doc-home-health-safety-assessment-report": {
      consistent: "home-safety-assessment-corrected.pdf",
      conflicting: "home-safety-assessment-conflict.pdf",
    },
    "doc-health-screening-form": {
      consistent: "health-screening-rivera.pdf",
      conflicting: "health-screening-rivera.pdf",
    },
  };
  const demoIssueDates: Record<string, string> = {
    "rfa-application-rivera.pdf": "2026-09-05",
    "home-safety-assessment-conflict.pdf": "2026-09-14",
    "home-safety-assessment-corrected.pdf": "2026-09-14",
    "health-screening-rivera.pdf": "2025-11-10",
  };

  const preparedBundle = bundle.map((item) => ({
    ...item,
    fileName:
      demoFileNames[item.document.id]?.[item.variant] ??
      `${item.variant}-${item.document.id}.pdf`,
  }));
  const unsupportedLiveItem = preparedBundle.find(
    ({ document, fileName }) =>
      requestedMode === "live" &&
      !DEMO_FILES[fileName] &&
      document.yields_facts.length > 0,
  );
  if (unsupportedLiveItem) {
    return NextResponse.json(
      { error: "The live sample packet is available for the TX to CA demo case." },
      { status: 422 },
    );
  }

  const runStartedAt = Date.now();
  // Finish every extraction before replacing the saved packet. A provider
  // failure must leave the case's prior evidence intact, not half-updated.
  let extractionFailure: unknown;
  const extractedBundle = await Promise.all(
    preparedBundle.map(async (item) => {
      const { fileName } = item;
      const canReadLive = requestedMode === "live" && DEMO_FILES[fileName];
      const bytes = canReadLive ? await demoDocumentBytes(fileName) : null;
      const result = canReadLive
        ? await extractDocument(
            { name: fileName, type: "application/pdf", size: bytes!.byteLength },
            bytes,
            item.document.id,
            ontology,
          )
        : extractSyntheticDocument(
            { name: fileName, type: "application/pdf", size: 1 },
            item.document.id,
            ontology,
            item.variant,
          );
      return { ...item, result };
    }),
  ).catch((error: unknown) => {
    extractionFailure = error;
    return null;
  });
  if (!extractedBundle) {
    return NextResponse.json(
      {
        error: `Live analysis failed; the previous packet was left unchanged. ${
          extractionFailure instanceof Error
            ? extractionFailure.message
            : "Please try again or use the reliable replay."
        }`,
      },
      { status: 502 },
    );
  }

  await clearCaseDocuments(auth.user.id, auth.record.id);
  const saved = [];
  for (const item of extractedBundle) {
    const { fileName, result } = item;
    const record = await saveCaseDocument(auth.user.id, auth.record.id, {
      definition_id: item.document.id,
      file_name: fileName,
      mime_type: "application/pdf",
      issue_date:
        demoIssueDates[fileName] ??
        (item.document.validity_period_days === null
          ? auth.record.window_start
          : addCalendarDays(auth.record.window_start, -300)),
      extraction_mode: result.mode,
      facts: result.facts,
    });
    if (record) saved.push(record);
  }
  const telemetry = extractedBundle.map(({ result }) => result.telemetry);
  const warnings = extractedBundle.flatMap(({ result }) => result.warnings);

  return NextResponse.json({
    documents: saved,
    rule_id: rule.id,
    run: {
      mode: requestedMode === "live" ? "live_anthropic" : "synthetic_cache",
      model: telemetry.find(({ model }) => model)?.model ?? null,
      duration_ms: Date.now() - runStartedAt,
      input_tokens: telemetry.reduce((total, item) => total + (item.input_tokens ?? 0), 0),
      output_tokens: telemetry.reduce((total, item) => total + (item.output_tokens ?? 0), 0),
      files_analyzed: saved.length,
      facts_extracted: saved.reduce((total, item) => total + item.facts.length, 0),
      warnings,
    },
  });
}
