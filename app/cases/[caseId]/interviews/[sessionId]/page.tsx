/**
 * /cases/[caseId]/interviews/[sessionId] — caseworker review of one interview.
 *
 * Authed. Two panes: extracted draft fields on the left, the verbatim
 * transcript on the right. Nothing on this page writes to the case fact
 * store; accepting a field is the only write, and it is per field.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { findCase } from "@/lib/store";
import { findSession, listFacts, listTurns } from "@/lib/interview-store";
import { getScript } from "@/lib/interview-scripts";
import { AppHeader } from "@/components/app-header";
import { InterviewReview } from "@/components/interview/interview-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview review · Adoption Care AI" };

export default async function InterviewReviewPage({
  params,
}: {
  params: Promise<{ caseId: string; sessionId: string }>;
}) {
  const user = await requireUser();
  const { caseId, sessionId } = await params;

  const [record, session] = await Promise.all([
    findCase(user.id, caseId),
    findSession(user.id, caseId, sessionId),
  ]);
  if (!record || !session) notFound();

  const script = getScript(session.script_id);
  if (!script) notFound();

  const [turns, facts] = await Promise.all([
    listTurns(user.id, sessionId),
    listFacts(user.id, sessionId),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || "Your";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader user={user} />
      <div className="border-b border-navy-800/12 bg-card">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 text-sm">
          <Link href={`/workflow/${record.id}`} className="text-navy-700 underline underline-offset-4">
            ← {record.label} · {record.id}
          </Link>
          <span className="text-muted-foreground">
            {firstName}&apos;s AI Intern · interview transcript
          </span>
        </div>
      </div>
      <InterviewReview
        caseId={record.id}
        session={session}
        script={script}
        initialTurns={turns}
        initialFacts={facts}
      />
    </div>
  );
}
