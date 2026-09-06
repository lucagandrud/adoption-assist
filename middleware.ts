/**
 * Refreshes the Supabase auth token on navigation.
 *
 * Access tokens are short-lived. Server components cannot write cookies, so
 * without this the session silently expires mid-session and a caseworker gets
 * bounced to /login in the middle of a case. Middleware runs before the render
 * and can write, so it is the one place the refreshed token can be persisted.
 *
 * A complete no-op when Supabase is not configured — the local JSON backend
 * uses a plain httpOnly cookie that never needs refreshing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates against Supabase and triggers the refresh. Do not
  // swap it for getSession(), which trusts the cookie's claims without
  // checking them and would leave a forged cookie unexamined.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
