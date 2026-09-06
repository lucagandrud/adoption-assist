import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { findCase, listCases } from "@/lib/store";
import { graphModelForCase } from "@/lib/workflow-model";
import { AppHeader } from "@/components/app-header";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { WorkflowDashboard } from "@/components/workflow/workflow-dashboard";

export const metadata = { title: "Case preflight · ICPC Preflight" };

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const user = await requireUser();
  const { caseId } = await params;

  const [record, cases] = await Promise.all([
    findCase(user.id, caseId),
    listCases(user.id),
  ]);
  if (!record) notFound();

  const model = await graphModelForCase(record);

  return (
    // The workbench is an app shell, not a document: it fills the viewport and
    // the graph canvas takes whatever height is left, so the page never
    // scrolls out from under the workflow.
    <div className="flex h-[calc(100dvh-0.25rem)] flex-col overflow-hidden">
      <AppHeader user={user} />
      <WorkflowToolbar cases={cases} current={record} />
      <WorkflowDashboard model={model} />
    </div>
  );
}
