import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { SignInForm } from "@/components/sign-in-form";

export const metadata = { title: "Sign in · ICPC Compliance Workbench" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/cases");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="grid w-full max-w-5xl gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <section className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Interstate Compact on the Placement of Children
          </p>
          <h1 className="text-4xl leading-tight text-navy-900">
            ICPC Compliance Workbench
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-navy-800/80">
            Caseworker tooling that derives the required document workflow from
            state regulations and verifies every uploaded document against them,
            so a placement packet is correct before it is filed.
          </p>

          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat value="~40,000" label="ICPC home study requests a year" />
            <Stat value="~40%" label="of placement requests denied" />
            <Stat value="180 days" label="statutory decision window" />
          </dl>

          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Figures: Sankaran (2014), ABA <em>Child Law Practice</em> 33(6);
            ICPC Regulations, AAICPC. A denial carries no right of appeal — the
            only remedy is a new request while the child waits.
          </p>
        </section>

        <section className="rounded-xl border border-navy-800/15 bg-card p-8 shadow-sm">
          <h2 className="text-xl text-navy-900">Caseworker sign in</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            For authorized child welfare staff.
          </p>
          <SignInForm />
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-navy-800/12 bg-beige-100/70 px-4 py-3">
      <dt className="font-mono text-lg font-semibold text-navy-800">{value}</dt>
      <dd className="mt-1 text-xs leading-snug text-muted-foreground">
        {label}
      </dd>
    </div>
  );
}
