/**
 * Supabase clients — installed and wired, not yet load-bearing.
 *
 * Persistence today goes through lib/store.ts (a local JSON file) so the app
 * runs with no configuration. When the project moves to Postgres + Auth +
 * Storage, these factories are the entry point and only lib/store.ts and
 * lib/session.ts change; no screen imports Supabase directly.
 *
 * Set in .env.local (see .env.local.example):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, or keep using the " +
        "local store in lib/store.ts.",
    );
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** For client components. */
export function supabaseBrowserClient() {
  const { url, anonKey } = config();
  return createBrowserClient(url, anonKey);
}

/** For server components, route handlers, and server actions. */
export async function supabaseServerClient() {
  const { url, anonKey } = config();
  const jar = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) {
            jar.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // Middleware refreshes the session instead.
        }
      },
    },
  });
}
