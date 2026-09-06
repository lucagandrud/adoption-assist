# Deployment

**Live:** https://foster-care-compliance.vercel.app

Vercel project `luca-s-team1/foster-care-compliance`, free (Hobby) tier, no payment method
attached. The app runs on the shared Supabase project — the deployed site and your laptop
read and write the same database.

---

## Redeploying

```bash
vercel --prod        # from the repo root
```

The GitHub repo is **not** connected to Vercel, so pushing to `luca` or `main` does not
deploy anything. Deploys are manual until someone runs `vercel git connect` and authorizes
the Vercel GitHub app on the private repo.

---

## Two URLs, and only one of them is public

| URL | Public? |
|---|---|
| `foster-care-compliance.vercel.app` (production alias) | ✅ anyone can open it |
| `foster-care-compliance-<hash>-luca-s-team1.vercel.app` (per-deployment) | ❌ redirects to a Vercel SSO login |

That is Vercel's standard Deployment Protection: it gates deployment-specific URLs and
leaves the production domain open. **Give judges the production alias**, never the URL the
CLI prints at the end of a deploy — that one will ask them to log into Vercel.

To make per-deployment URLs public too: Vercel dashboard → project → Settings →
Deployment Protection.

---

## Environment variables

Set for **Production** via `vercel env add`, and also committed in [`.env`](../.env):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Both are public by design; row-level security protects the data. See
[`docs/supabase-setup.md`](supabase-setup.md).

Belt and braces is deliberate. If these fail to load, `isSupabaseConfigured()` returns false
and the app silently falls back to the JSON file store in `lib/store-json.ts`, which writes
to `.data/` — a path that does not exist and cannot be written on Vercel's read-only,
ephemeral filesystem. The build would still succeed and sign-up would fail at runtime.

**The check:** the sign-in page prints "Running on local storage" *only* when Supabase is
missing. On the live site that line must be absent. It currently is.

```bash
curl -s https://foster-care-compliance.vercel.app/login | grep -c "Running on local storage"
# 0 = on Supabase.  1 = fell back to the file store, and the deploy is broken.
```

---

## Supabase Auth: still to do

Supabase does not know about the production origin yet. In the Supabase dashboard →
**Authentication** → **URL Configuration**:

- **Site URL:** `https://foster-care-compliance.vercel.app`
- **Redirect URLs:** add `https://foster-care-compliance.vercel.app/**`

This is dashboard-only; the CLI cannot set it without a linked project and an access token.

It is **not currently blocking** — the app uses email + password with email confirmation
turned off, so no redirect link is ever generated. It becomes load-bearing the moment
anyone adds password reset, magic links, or OAuth.

---

## Verified on the live URL

Checked against `https://foster-care-compliance.vercel.app`, not locally:

- sign up → lands on `/cases`
- caseload grid renders the 5 seeded cases
- opening a case renders the workflow graph (6 nodes, 6 edges)
- refresh keeps the session (`middleware.ts` token refresh)
- sign out → sign back in → the same 5 cases
- the 5 rows are really in `public.cases` in Postgres, and RLS returns only that
  account's rows
