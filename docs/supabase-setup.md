# Supabase setup

> ## The project already exists. You have nothing to do.
>
> The team's Supabase project is provisioned, the schema is applied, and the connection
> details are committed in [`.env`](../.env). Clone the repo, `npm install`, `npm run dev`,
> sign up — you are on the shared database.
>
> ```bash
> git clone https://github.com/lucagandrud/icpc-compliance-engine.git
> cd icpc-compliance-engine
> npm install
> npm run dev
> ```
>
> **Do not create your own project.** Everyone points at the same one, so a migration applied
> once works for both of you and either laptop can run the demo.
>
> The rest of this page is how that project was set up, plus troubleshooting. Read it if
> something breaks or you are adding a migration.

---

## Why the keys are in the repo

`.env` is tracked on purpose. The Supabase URL and **anon key are public by design** — the
anon key is served to every visitor's browser on every deploy. Row-level security in
[`supabase/migrations/`](../supabase/migrations/) is what protects the data, not the key being
hidden.

**Actual secrets go in `.env.local`,** which is gitignored: `ANTHROPIC_API_KEY`, and the
Supabase `service_role` key if you ever need it. The service_role key bypasses RLS entirely
and must never be committed.

---

## Adding a migration

Do not edit `0001_init.sql` — it is already applied. Add a new numbered file
(`0002_case_artifacts.sql`), paste it into the Supabase **SQL Editor**, and run it. Commit the
file so the schema history lives in git.

Since you share one database, **tell the other person before running DDL.** A dropped column
breaks their running app instantly.

---

## How the project was set up

**Time: about 10 minutes.** Only needed if you are rebuilding from scratch.

---

## What you get

| | Local (default) | Supabase |
|---|---|---|
| Storage | `.data/workbench.json` on your machine | Postgres |
| Auth | Cookie holding a user id | Real credentials, verified JWT |
| Isolation | Filtered in application code | **Enforced by the database** |
| Survives | Restarts | Everything; teammates see the same data |

The isolation row is the one that matters. Under Supabase, every policy is
`auth.uid() = owner_user_id`, so a route handler that forgets to filter by user *still* cannot
return another caseworker's cases — Postgres refuses to hand them over.

---

## 1. Create the project

1. Go to **https://supabase.com/dashboard** and sign in with GitHub.
2. **New project**.
   - Name: `foster-care-compliance`
   - Database password: generate one and save it in your password manager. You will not need
     it for this app, but you cannot retrieve it later.
   - Region: pick the one nearest you.
3. Wait about two minutes for provisioning.

---

## 2. Run the schema

1. In the left sidebar: **SQL Editor** → **New query**.
2. Open [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql), copy the
   whole file, paste it in.
3. **Run**.

You should see `Success. No rows returned.` The script is idempotent — running it twice is
safe.

**Verify it worked:** go to **Table Editor**. You should see `profiles` and `cases`, both
showing an **RLS enabled** badge. If that badge is missing, stop and re-run the script — an
unbadged table is world-readable.

---

## 3. Turn off email confirmation

**Authentication** → **Sign In / Providers** → **Email** → turn **Confirm email** off, and save.

With it on, signing up sends an email and gives you no session until someone clicks the link.
That is correct for production and fatal in a demo on conference wifi.

---

## 4. Copy your keys

**Project Settings** → **API**. You need two values:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a long string starting `eyJ...`

Create `.env.local` in the repo root:

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> The anon key is **not** a secret — it is designed to sit in browser JavaScript, and row-level
> security is what protects the data. Do not use the `service_role` key here; it bypasses RLS
> entirely and would hand every caseworker's cases to anyone who opened dev tools.

`.env.local` is gitignored. Keep it that way.

---

## 5. Restart and check

```bash
# stop the dev server, then
npm run dev
```

Env vars are read at boot — a running server will not pick them up.

Sign up with a fresh email. Then in Supabase: **Table Editor** → **cases**. You should see five
rows, `ICPC-2026-0231` through `0235`.

The "Running on local storage" line under the sign-in form disappears once Supabase is live.
That is your indicator of which backend you are on.

---

## Verifying isolation actually works

Worth doing once, because it is the whole point and it is the thing a judge might ask about.

1. Sign up as `worker-a@example.com`, note the case labels.
2. Sign out. Sign up as `worker-b@example.com`.
3. Worker B sees their own five seeded cases — different docket numbers, none of A's.
4. Try to open one of A's cases by pasting its URL, e.g. `/workflow/ICPC-2026-0231`.
   You get "case not found," because the row-level security policy filtered it out before the
   query returned.

That last step is the demonstration: it is not the application choosing to hide the case, it is
the database refusing to return it.

---

## Troubleshooting

**"Supabase is not configured"** — env vars are missing or the server was not restarted after
adding them. Values must start with `NEXT_PUBLIC_`.

**Signed up but no cases appear** — the seed insert failed, almost always because the schema
was not run. Check **Table Editor** for a `cases` table.

**"Account created. Check your email to confirm it."** — email confirmation is still on. Go
back to step 3.

**Everything 401s after a few minutes** — [`middleware.ts`](../middleware.ts) refreshes the
access token and must be at the repo root, not inside `app/`.

**Rows visible that should not be** — RLS is off on that table. Re-run the migration and
confirm the **RLS enabled** badge.

---

## What is deliberately not here

- **Password reset.** Not needed for a 26-hour build with synthetic accounts.
- **Supabase Storage for uploads.** Comes with handoff Step 5; documents currently go through
  the extraction pipeline without being persisted.
- **Ontology tables.** The ontology is versioned JSON in `/ontology`, loaded and validated at
  boot. It is code, not user data, and does not belong in Postgres.
