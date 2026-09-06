import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import type { UserRecord } from "@/lib/types";

export function AppHeader({ user }: { user: UserRecord }) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="border-b border-navy-900/40 bg-navy-800 text-beige-100">
      <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-6 py-3">
        <Link href="/cases" className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight text-beige-50">
            Foster Care Compliance AI
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-5 text-sm">
          <Link
            href="/cases"
            className="text-beige-200 underline-offset-4 hover:text-beige-50 hover:underline"
          >
            Cases
          </Link>

          <div className="flex items-center gap-3 border-l border-beige-100/20 pl-5">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-gold/85 text-xs font-semibold text-navy-900"
            >
              {initials || "??"}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm text-beige-50">{user.name}</span>
              <span className="block text-[11px] text-beige-300">
                {user.agency || user.email}
              </span>
            </span>
            <SignOutButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
