# Lapis Automotive Group — Sales Tracker

Internal tool for the Lapis Automotive Group to log each store's daily sales
and activity numbers and roll them up into month‑to‑date, projected, and
annual views.

Access is per‑store: each user is an **editor** (can enter/edit numbers) or a
**viewer** (read‑only) on the stores they're assigned to, and can be assigned
to multiple stores with a different role at each. **Super admins** see and edit
every store and manage users.

**Stack:** Next.js 16 (App Router) + Supabase (Postgres, Auth, Row‑Level
Security), deployed on Vercel.

**Live app:** https://lapisproject.vercel.app (auto‑deploys from `main`).

## Features

- **Daily entry** — per store, per day: new & used unit counts, front‑ and
  back‑end gross for new and used, and activity (manager calls, sales calls,
  appointments, confirmed appointments), plus free‑text notes. Editing a past
  day is a click away from the reports table.
- **Dashboard** — one card per store showing **today's** breakdown, today's
  notes, and Today / Month‑to‑date / **Projected month‑end** gross and units.
  The projection assumes the current daily pace holds for the rest of the month.
- **Reports** — a "This month" panel (Today / MTD / Projected across the full
  new/used front/back/gross breakdown), an **Annual** rollup with the same
  detail, a compact **Monthly** trend list, and a **Daily** table with per‑day
  detail and notes.
- **Admin** — create stores, onboard users, assign per‑store editor/viewer
  access, reset passwords, and grant/revoke super admin.
- **Account** — every user can change their own password, and opt each device
  into push notifications.
- **Push notifications** — when a day's numbers are entered, users an admin has
  enabled are notified, but only for stores they can access. Web Push to the
  installed app (iOS requires the Home Screen install).
- **Installable** — a web app manifest + icons let the site be added to a
  phone home screen.

## Access control

- `dealership_members` maps a user to a store with a role (`editor` or
  `viewer`); a user can have many such rows across stores.
- `profiles.is_super_admin` grants edit access to every store.
- All of it is enforced with Postgres **Row‑Level Security**, not just hidden
  in the UI — a viewer's direct API call to write is rejected by the database.
  See the policies in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Local development

### 1. Environment variables

> **This app now shares a Supabase project with the Lapis Launchpad**
> (`iyjaoyaqgfqytxqdtqfs`), so one account signs you into both. Its previous
> project `bvtlkvsytlyxcowyavcj` is no longer used, but has been left untouched
> as a rollback: point the three Supabase variables back at it and this app
> behaves exactly as it did before.
>
> The apps stay separate — separate repos, deployments and URLs. Only the
> database and auth directory are shared. This app's tables (`dealerships`,
> `daily_entries`, `positions`, …) kept their names, the Launchpad's sit
> alongside them, and `profiles` is now one table serving both. See
> `supabase/migrations/0009_consolidate_sales_tracker.sql` in the Launchpad
> repo.

```bash
cp .env.local.example .env.local
```

Fill in the keys from the Supabase dashboard (**Project Settings → API Keys**):

- `NEXT_PUBLIC_SUPABASE_URL` — the shared project, `iyjaoyaqgfqytxqdtqfs`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **publishable** key (`sb_publishable_…`).
- `SUPABASE_SERVICE_ROLE_KEY` — the **secret** key (`sb_secret_…`). Server‑only
  (used for admin actions like creating/deleting users); never expose it to the
  browser or commit it.

For push notifications, also set the VAPID keys (generate a pair with
`node -e "console.log(require('web-push').generateVAPIDKeys())"`):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — public key, exposed to the browser.
- `VAPID_PRIVATE_KEY` — server‑only secret.
- `VAPID_SUBJECT` — a contact `mailto:` (e.g. `mailto:admin@lapisauto.com`).

Notifications are optional: if the VAPID vars are absent, saving still works and
sending is a safe no‑op.

### 2. Database migrations

Apply the SQL files in [`supabase/migrations/`](supabase/migrations/) **in
order** (`0001` → `0005`) via the Supabase SQL editor, the Supabase CLI, or the
Supabase MCP server. In order they: create the schema, RLS policies, and
rollup views; split gross by new/used; keep entries when a user is deleted; add
activity metrics; and add daily notes.

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## First super admin

There's no public sign‑up. To bootstrap the first account:

1. In the Supabase dashboard: **Authentication → Users → Add user** (email +
   password).
2. In the SQL editor, grant super admin:

   ```sql
   update public.profiles set is_super_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Log in at `/login`. The **Admin** link appears in the header.

## Onboarding the rest of the team

From the **Admin** page, "Add a user" creates the account with a **temporary
password shown once** (no email is sent — share it securely). Assign the user to
one or more stores as editor or viewer. Users change their own password on the
**Account** page; a super admin can also reset any user's password.

## Forgotten passwords

`/login` offers **Forgot your password?**, which emails a link. The form always
reports success, even for an address with no account — otherwise it becomes a
way to find out who works here.

Two things about that link are worth knowing:

- **It opens the Launchpad, not this app.** Supabase has one Site URL per
  project and both apps share the project, so `/auth/confirm` lives over there.
  That is fine: the session cookie is shared across `dealerhaven.app`, so
  setting a password on the Launchpad signs you in here too. The confirmation
  screen says so, because otherwise landing on a different domain looks wrong.
- **It is sent without PKCE**, via `lib/supabase/reset-client.ts`. The
  `@supabase/ssr` client hardcodes `flowType: "pkce"` after spreading your
  options, and a PKCE link only redeems in the browser that requested it —
  useless when the reset is requested on a desktop and the email is read on a
  phone.

`/forgot-password` is in `PUBLIC_PATHS` in `proxy.ts`, which is a separate list
from `SIGNED_OUT_ONLY`: "may be seen signed out" and "may *only* be seen signed
out" are different questions, and conflating them is what broke the Launchpad's
emailed links once already.

## Deployment (Vercel)

Hosted on Vercel; every push to `main` redeploys. To reproduce:

1. Import `shadowege7/lapisproject` at [vercel.com/new](https://vercel.com/new)
   (Next.js is auto‑detected — no `vercel.json` needed).
2. Add the environment variables from `.env.local` — the three Supabase keys
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`) plus, for push notifications, the three VAPID
   vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
   Changing env vars requires a redeploy to take effect.
3. The **Site URL** under **Supabase → Authentication → URL Configuration**
   must point at the **Launchpad** (`https://lapis.dealerhaven.app`), not at
   this app. It is what every emailed auth link is built from, including the
   ones this app's forgot-password form sends.

GitHub Pages is **not** an option — the app relies on server‑rendered pages,
Server Actions, and the `proxy.ts` middleware, none of which run on static
hosting.

## Project structure

- `app/login` — sign‑in page (Server Action calls Supabase Auth).
- `app/(app)/dashboard` — per‑store cards: today's numbers, notes, and
  Today / MTD / Projected totals.
- `app/(app)/dealerships/[id]/entry` — daily entry form, editors only.
- `app/(app)/dealerships/[id]/reports` — This month / Annual / Monthly / Daily.
- `app/(app)/admin` — super‑admin: stores, users, per‑store roles, passwords.
- `app/(app)/account` — change your own password.
- `app/manifest.ts`, `app/icon.png`, `app/apple-icon.png` — PWA / favicons.
- `proxy.ts` — Next.js 16's `middleware.ts` replacement; refreshes the Supabase
  session and redirects signed‑out users to `/login`.
- `lib/supabase/{client,server,admin}.ts` — browser, server, and service‑role
  Supabase clients (`admin.ts` also has a resilient `listAllUsers` helper).
- `lib/projection.ts` — month‑end pace projection.
- `lib/format.ts` — currency/date formatting helpers.
