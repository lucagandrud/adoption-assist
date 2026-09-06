import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { backendName } from "@/lib/store";
import { SignInForm } from "@/components/sign-in-form";

export const metadata = { title: "Sign in · Adoption Care AI" };

/**
 * Deliberately bare. The statistics and the pitch live in the presentation —
 * a caseworker opening this screen at 8am is signing in, not being sold to.
 */
export default async function LoginPage() {
  if (await getSessionUser()) redirect("/cases");
  const backend = backendName();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Interstate Compact on the Placement of Children
          </p>
          <h1 className="mt-2 text-2xl text-navy-900">
            Adoption Care AI
          </h1>
        </div>

        <div className="border-[3px] border-double border-beige-500 bg-beige-100 p-7">
          <SignInForm />
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          Synthetic records only. Do not enter a real family&apos;s details.
          {backend === "local" ? (
            <>
              {" "}
              Running on local storage — case data stays on this machine.
            </>
          ) : null}
        </p>
      </div>
    </main>
  );
}
