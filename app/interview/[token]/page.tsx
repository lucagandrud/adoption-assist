/**
 * /interview/[token] — the one screen a household member ever sees.
 *
 * Public. No sign-in, no account, no case visibility. The token in the URL
 * is the whole credential, validated server-side against the store (under
 * Supabase, via the SECURITY DEFINER get_interview_by_token function; anon
 * has no table access). middleware.ts only refreshes Supabase cookies and
 * gates nothing, so this route is reachable without a session.
 *
 * An unknown or expired token renders a plain message. No redirect to
 * /login, no stack trace, and the same message for "unknown" and "expired"
 * so the page cannot be used to probe which tokens exist.
 */

import { getSessionByToken, getTurnsByToken } from "@/lib/interview-store";
import { getScript } from "@/lib/interview-scripts";
import { InterviewFlow } from "@/components/interview/interview-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake interview · Adoption Assist" };

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Refuse anything that is not a plausible token before touching the store.
  const session = /^[a-f0-9]{64,}$/i.test(token)
    ? await getSessionByToken(token)
    : null;

  if (!session) return <Notice title="This link is no longer valid." body="Interview links expire after seven days. If you were expecting to complete an interview, ask your caseworker to send a new link." />;

  if (session.status === "complete" || session.status === "reviewed") {
    return <Notice title="This interview has been completed." body="Thank you. Your caseworker will review the transcript. There is nothing more to do here." />;
  }

  const script = getScript(session.script_id);
  if (!script) return <Notice title="This link is no longer valid." body="The interview script for this link is not available. Ask your caseworker to send a new link." />;

  const turns = await getTurnsByToken(token);

  return (
    <InterviewFlow
      token={token}
      session={session}
      script={script}
      priorTurns={turns}
    />
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
        Adoption Assist
      </p>
      <h1 className="mt-2 text-3xl text-navy-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-navy-800/80">{body}</p>
    </main>
  );
}
