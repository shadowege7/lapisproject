# Dealership Sales Tracker

Internal tool for a multi-dealership group to log daily new/used unit counts
and front-end/back-end gross, with automatic monthly and annual rollups.
Access is per-dealership: each user is an **editor** (can enter/edit numbers)
or **viewer** (read-only) on the dealerships they're assigned to. **Super
admins** see and edit every dealership and manage user access.

Stack: Next.js (App Router) + Supabase (Postgres, Auth, Row-Level Security).

**Live app:** https://lapisproject.vercel.app (auto-deploys from `main` via Vercel).

## 1. Configure environment variables

Copy the example file and fill in your Supabase project's anon key and
service role key (Supabase dashboard → Project Settings → API):

```bash
cp .env.local.example .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` is already filled in for project `bvtlkvsytlyxcowyavcj`.
`SUPABASE_SERVICE_ROLE_KEY` is used server-side only (inviting users from the
Admin page) — never expose it to the browser or commit it.

## 2. Run the database migration

Open the Supabase SQL editor for this project and run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It
creates the `dealerships`, `dealership_members`, `daily_entries`, and
`profiles` tables, the `monthly_summary`/`annual_summary` rollup views, and
all Row-Level Security policies.

(If the Supabase MCP server is connected and authenticated in this workspace,
you can instead ask Claude to run the migration for you.)

## 3. Create your first super admin

There's no public sign-up page — access is invite-only. To bootstrap the
first account:

1. In the Supabase dashboard, go to **Authentication → Users → Add user**
   and create yourself an account (email + password).
2. In the SQL editor, run:

   ```sql
   update public.profiles set is_super_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Log in at `/login` with that account. You'll see an **Admin** link in the
   header — use it to create dealerships and invite the rest of your team.

## 4. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Deployment (Vercel)

The app is hosted on Vercel and redeploys automatically on every push to
`main`. To reproduce the setup:

1. Import `shadowege7/lapisproject` at [vercel.com/new](https://vercel.com/new)
   (Next.js is auto-detected — no `vercel.json` needed).
2. Add the three environment variables from `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (server-only; keep it secret).
3. In **Supabase → Authentication → URL Configuration**, set the **Site URL**
   to the production domain and add `<domain>/**` to the redirect allowlist so
   invite emails link back to the deployed app.

GitHub Pages is **not** an option: this app relies on server-rendered pages,
Server Actions, and the `proxy.ts` middleware, none of which run on static
hosting.

## How access control works

- `dealership_members` maps a user to a dealership with a role (`editor` or
  `viewer`).
- `profiles.is_super_admin` grants edit access to every dealership.
- All of this is enforced with Postgres Row-Level Security (see the policies
  in `supabase/migrations/0001_init.sql`), not just hidden in the UI — so
  even a direct API call from a viewer account is rejected by the database.

## Project structure

- `app/login` — sign-in page (Server Action calls Supabase Auth)
- `app/(app)/dashboard` — dealerships the signed-in user can access, with
  this month's snapshot
- `app/(app)/dealerships/[id]/entry` — daily entry form (editors only)
- `app/(app)/dealerships/[id]/reports` — daily table + monthly/annual rollups
- `app/(app)/admin` — super-admin only: create dealerships, invite users,
  assign dealership access, grant/revoke super admin
- `proxy.ts` — Next.js 16's replacement for `middleware.ts`; refreshes the
  Supabase session and redirects signed-out users to `/login`
- `lib/supabase/{client,server,admin}.ts` — browser, server, and
  service-role Supabase clients
