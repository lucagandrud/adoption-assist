import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractDocument,
  extractSyntheticDocument,
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
});

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
    const metadata = {
      name: parsed.data.file_name,
      type: parsed.data.mime_type,
      size: parsed.data.size,
    };
    const result = uploadedFile
      ? await extractDocument(
          metadata,
          new Uint8Array(await uploadedFile.arrayBuffer()),
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
      { document: saved, warnings: result.warnings },
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
export async function PUT(_request: Request, context: Context) {
  const auth = await authenticatedCase(context);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  const [first, second] = selectedDocuments.filter(({ yields_facts }) =>
    yields_facts.includes(rule.facts_involved[0]),
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

  await clearCaseDocuments(auth.user.id, auth.record.id);
  const saved = [];
  for (const item of bundle) {
    const result = extractSyntheticDocument(
      { name: `${item.variant}-${item.document.id}.pdf`, type: "application/pdf", size: 1 },
      item.document.id,
      ontology,
      item.variant,
    );
    const record = await saveCaseDocument(auth.user.id, auth.record.id, {
      definition_id: item.document.id,
      file_name: `${item.variant}-${item.document.id}.pdf`,
      mime_type: "application/pdf",
      issue_date:
        item.document.validity_period_days === null
          ? auth.record.window_start
          : addCalendarDays(auth.record.window_start, -300),
      extraction_mode: result.mode,
      facts: result.facts,
    });
    if (record) saved.push(record);
  }

  return NextResponse.json({ documents: saved, rule_id: rule.id });
}
