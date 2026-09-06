import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { findCase, listCases } from "@/lib/store";
import { listSessions } from "@/lib/interview-store";
import { INTERVIEW_SCRIPTS } from "@/lib/interview-scripts";
import { SendIntern } from "@/components/interview/send-intern";
import { graphModelWithFacts } from "@/lib/workflow-model";
import { AppHeader } from "@/components/app-header";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { WorkflowDashboard } from "@/components/workflow/workflow-dashboard";

export const metadata = { title: "Workflow · ICPC Compliance Workbench" };

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const user = await requireUser();
  const { caseId } = await params;

  const [record, cases, sessions] = await Promise.all([
    findCase(user.id, caseId),
    listCases(user.id),
    listSessions(user.id, caseId),
  ]);
  if (!record) notFound();

  const model = await graphModelWithFacts(user.id, record);
  const firstName = user.name.trim().split(/\s+/)[0] || "Your";

  return (
    // The workbench is an app shell, not a document: it fills the viewport and
    // the graph canvas takes whatever height is left, so the page never
    // scrolls out from under the workflow.
    <div className="flex h-[calc(100dvh-0.25rem)] flex-col overflow-hidden">
      <AppHeader user={user} />
      <WorkflowToolbar
        cases={cases}
        current={record}
        actions={
          <SendIntern
            caseId={record.id}
            firstName={firstName}
            sessions={sessions}
            scripts={INTERVIEW_SCRIPTS.map((s) => ({ id: s.id, label: s.label }))}
          />
        }
      />
      <WorkflowDashboard model={model} />
    </div>
  );
}
