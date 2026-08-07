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
  back‑end gross for new and used, and activity (sales calls and
  appointments), plus free‑text notes. Editing a past day is a click away from
  the reports table.
- **Dashboard** — one card per store showing **today's** breakdown, today's
  notes, and Today / Month‑to‑date / **Projected month‑end** gross and units.
  The projection assumes the current daily pace holds for the rest of the month.
- **Reports** — a "This month" panel (Today / MTD / Projected across the full
  new/used front/back/gross breakdown), an **Annual** rollup with the same
  detail, a compact **Monthly** trend list, and a **Daily** table with per‑day
  detail and notes.
- **Budgets** — a monthly unit goal per store, shown on the dashboard tile and
  used to colour the projection green or red. Editable by admins and by anyone
  an admin permits.
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

**The migrations live in the Launchpad repo, not here.** The two apps share one
Supabase project, so there is one migration history, kept in
`lapis-launchpad/supabase/migrations/` (`0001` … onward). Apply those in order
against the shared project. This repo no longer carries its own copy — the old
pre-consolidation set was removed because applying it would collide with the
shared schema (and this repo ships an `.mcp.json`, which made an accidental
`apply_migration` from here one command away).

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

Names are entered as **first / preferred / last** rather than one box, so
someone who goes by a name other than their legal one is shown correctly
without losing what payroll needs. `profiles.full_name` — which this app reads
everywhere — is composed from those parts by `lib/names.ts` rather than typed,
so the two cannot disagree. That file is a copy of the Launchpad's: the apps
share the `profiles` table but not a module, so a change to the rule has to be
made in both.

### Changing the address someone signs in with

On the **Admin** page, inside a user's row, collapsed behind the address itself
so it cannot be edited by accident. It is their identity for the Launchpad too
— one Supabase project sits behind both — so it changes in both at once.

It applies immediately rather than waiting on a confirmation click in the old
mailbox, which is the point: this gets used when an address was wrong or is
unreachable. **Nothing is emailed**, so tell them, or their next sign-in fails
for no visible reason.

A collision is checked before the call rather than after: Supabase reports the
underlying unique violation as a 500 whose `AuthError.message` is the literal
string `"{}"` — the same empty-error shape the test-email form works around.
`profiles.email` is kept in step with `auth.users` by a database trigger (see
`0014_sync_profile_email.sql` in the Launchpad repo), so asking it first gives
a real answer.

## Sprinter

Mercedes-Benz sells Sprinter vans alongside its cars, so those stores get a
**third vehicle category** next to New and Used, on the entry form, the
dashboard tile, the daily and summary tables, and both CSV exports.

It is a genuine third bucket, not a slice of New: a Sprinter is entered once,
under Sprinter, and its units and gross add to the store's totals alongside the
other two. Nothing is entered twice, so nothing can be double-counted.

Which stores see it is decided by `dealerships.tracks_sprinters`, not by name —
hardcoding "Mercedes-Benz of Northern Arizona" would rot the first time a store
is renamed or a second one starts selling vans. Turning it on elsewhere is one
UPDATE:

```sql
update public.dealerships set tracks_sprinters = true where name = '…';
```

Stores without the flag never see the fields, and their rows keep the column
defaults of zero — so no existing total moved when this was added. See
`0015_sprinter_units.sql` in the Launchpad repo.

A flagged store shows its Sprinter figure **even at zero**, in the Today / This
month / Projected lines and on the dashboard tile. It is a real fact about the
day for that store, the same way `0 used` is; hiding the line until one sold
would make the category look broken. Stores without the flag never show it. The
all-stores rollup shows it whenever any store sells them, so the company figure
does not drop the category on a slow day.

The dashboard tile sits **inline with New and Used at every width**. That works
because `VehicleStat` stacks its label above the unit count instead of putting
them side by side: side by side, a long label like SPRINTER pushed "0 units"
onto a second line while NEW and USED stayed on one, and that tile's
Front/Back/Gross rows then sat lower than its neighbours'. Stacking gives every
tile the same two-line head whatever the label says.

## Budgets

A **budget** is the store's unit goal for the month — how many cars it means to
sell, split New / Used / Sprinter. It carries no gross: the goal a sales floor
works to is a car count, and mixing a dollar figure into it would only invite
the question of which gross was meant.

It sits on the dashboard tile **between This month and Projected**, which is
where it reads as the line the month is measured against: what has sold, what
was aimed for, where the month lands.

The projection is then coloured against it — **green** when the month-end
projection reaches the goal, **red** when it falls short — separately for New,
Used and Sprinter, so a store beating its used goal while missing new sees
exactly that rather than one blended verdict. Hovering a figure gives the
comparison in words.

**A category with no budget is left uncoloured, not marked red.** A goal nobody
set is not a goal that was missed, and colouring it red would train people to
ignore the colour. A store with no budget row at all shows "Not set" and a dash
instead of a total.

One row per store per month, so raising a goal mid-month does not rewrite
history; a check constraint pins `month` to the first of the month, which stops
two rows for one month drifting apart. The row records who last changed it and
when, and the store page shows that line — a goal that moves is worth
attributing.

### Who may edit a budget

Two things grant it, and both are in `profiles`:

- **Being a super admin.**
- **`can_edit_budgets`**, granted per user under **Admin → Users →
  *Allow budget editing***. Granted users wear a "budgets" chip in the list.

The editor is on the store page and simply is not rendered for anyone else, but
the real enforcement is **RLS**: `store_budgets` is writable only when
`public.can_edit_budgets()` says so, and the save uses the signed-in user's own
Supabase client, so a hand-made POST from someone without the permission is
rejected by the database. Reading is separate and wider — anyone who can see
the store can see its goal.

`can_edit_budgets` is also listed in the guard trigger on `profiles`, so nobody
can grant it to themselves through the ordinary "update my own profile" policy.

See `0018_store_budgets.sql` in the Launchpad repo.

## The order of the store cards

Porsche, Audi, Land Rover, Honda, Ferrari, Mercedes — the order the business
asked for, which is neither alphabetical nor derivable from anything else in
the table, so it is stored in `dealerships.sort_order`
(`0020_dealership_sort_order.sql`).

A column rather than a list of names in the dashboard: hardcoding the order
would rot the first time a store is renamed, and a new store would silently
fall off the end of the match. The names appear once, in the migration that
sets the numbers, and are never read again.

`sort_order` is **nullable**, and the dashboard orders by `sort_order` with
nulls last, then by name. So a store nobody has placed lands at the end among
its alphabetical peers, which is a predictable spot for one that has just been
created. Zero would have shoved it to the front.

**Admin → Dealerships** puts the number in a box in front of each store name.
Change it and click away — it saves on blur, like the role dropdowns and the
report checkboxes, so there is no button to forget. Emptying a box unsets the
number and sends that store to the end.

The admin list is sorted the same way as the dashboard, so the numbers being
typed line up with the order they produce.

Two deliberate loosenesses: **duplicates are allowed**, because an admin
renumbering six stores one box at a time would otherwise be blocked halfway
through by a collision they are about to resolve — two stores sharing a number
just fall back to alphabetical. And the box **stops clicks from reaching the
`<summary>` it sits in**, so typing a number does not also open the store's
panel.

Or from SQL:

```sql
update public.dealerships set sort_order = 2 where name = '…';
```

## Activity metrics

Two are recorded each day: **sales calls** and **appointments**.

There were four. Manager calls and confirmed appointments were dropped in
`0019_drop_unused_activity_metrics.sql` once the business stopped using them —
columns and all, rather than left sitting at zero, so nobody has to work out
later whether a column of noughts means "none happened" or "nobody filled it
in". The table was empty at the time, so nothing was lost.

## The daily report email

When a store's numbers are saved, the day is emailed to whoever an admin
subscribed for that store: the New / Used / Sprinter breakdown, the totals, the
activity counts, the notes, and who entered it.

**Admin → Dealerships → *(open a store)* → Daily report email** picks the
recipients. Every user is listed, not only that store's members, because the
two lists answer different questions — a regional manager may want the Ferrari
numbers without editing them, and plenty of editors do not want a mail every
evening. Each checkbox saves on click; there is no Save button to forget.

Some deliberate choices:

- **Recipients are accounts, not typed-in addresses**, so an address can never
  drift from the person it belongs to (`profiles.email` is itself trigger-
  maintained — see `0014` in the Launchpad repo). Anyone marked inactive there
  is skipped even if nobody remembered to unsubscribe them.
- **Addresses go in `bcc`**, so the list is not published to everyone on it.
- **It sends on every save, including corrections to an earlier day**, and the
  wording says "Updated numbers for" when the day already existed. Silence
  after a correction would be worse than a second mail.
- **The CSV importer sends nothing.** Backfilling a year would otherwise fire
  hundreds of emails.
- **The send is awaited, not left dangling.** A serverless function can be
  frozen the moment its response is sent, and an unawaited send gets killed
  part-way often enough to look like flaky delivery.
- **It can never fail a save.** Mail problems are logged and swallowed; the
  entry is already committed by then.

### Configuring the mail server

**Admin → Mail server.** Host, port, username, password and an optional From
address, changeable at any time without a redeploy, with a **Send test** button
right beneath — SMTP settings are the kind of thing you want to prove rather
than hope about.

The Google Workspace relay already used for Supabase auth mail works as-is, and
so does any provider that speaks SMTP.

The credentials live in `public.smtp_settings`, which is **deliberately not
`app_settings`**: that table is readable by every signed-in user by design,
because it drives shared UI, and a relay password there would be handed to
every employee with a login. `smtp_settings` has no RLS policies at all and its
grants are revoked, so PostgREST returns `403` to a super admin asking directly
— only `service_role` reaches it. Being a super admin is checked in the action,
in code. The saved password is never sent to the browser; the form shows only
that one exists, and leaving the field blank keeps it, so a typo in the host
can be fixed without re-entering the secret.

The screen shows when the settings were last changed and by whom. There is one
row for the whole business, so a save replaces what was there — that line is
how an unexpected change gets noticed.

**Never point these at a test server on the live database.** They are a single
shared row: doing so replaces the real credentials for everyone, and clearing
them afterwards does not bring the password back. Test against a local Supabase
stack, or a throwaway project.

`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` still
work as a fallback (see `.env.local.example`), so a fresh deployment can send
before anyone opens the settings, and there is a way back in if what is saved
is ever wrong. Saved settings win; the admin screen says which is in use.

**With neither, nothing is sent.** The admin screen says so rather than letting
someone believe reports are going out, and recipients chosen in the meantime
are saved and take effect the moment credentials land.

Note the **Sign-in email** section is a different thing: password resets and
invitations are sent by Supabase, using the SMTP configured under Supabase →
Authentication. Changing the mail server here does not affect those.

## Passwords

Temporary passwords are generated by `lib/password.ts`, a copy of the
Launchpad's. **No dashes or other separators.** Grouped text reads more easily,
but people retype these into a password box and the separators get dropped,
mistyped as spaces, or swallowed by autofill — and the sign-in then fails for
no visible reason.

Accounts created here are flagged `must_change_password`, and an admin password
reset sets it again. `/set-password` then holds the person until they have
chosen their own — they can sign in with the temporary one, but every page
bounces them to that form first.

The gate lives in `requireUser()` in `lib/auth.ts`, called from the `(app)`
layout, which every page in the group renders inside. **Not in `proxy.ts`**:
the flag is on the profile row and the proxy only holds the session, so
checking there would mean a database round trip on every request.

The flag is shared with the Launchpad — one `profiles` row, one auth directory
— so whichever app the person opens first prompts them, and clearing it there
clears it for both.

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

## What it's called

**Sales Portal** to the people using it — `APP_NAME` in `app/brand.tsx`, which
the footer, the browser tab, the sign-in cards and the dashboard welcome all
read from. One constant, so it cannot end up saying two things in two places.

The repository, the Vercel project and these docs still say "sales tracker".
That is the internal name for the thing, not the product name.

That includes the places the name leaves the app: the web manifest, the daily
report's button, the admin test email, and push notification titles.

**An installed app keeps the old label.** A phone caches the launcher name from
when it was added to the home screen, and re-reading the manifest does not
change it — the `?v=` on the icons does nothing for this. Anyone who installed
it as "Lapis Sales" keeps that until they remove and re-add it.

## The all-stores rollup

The group-wide totals at the top of the dashboard. Two things grant it:

- **A position**, under Admin → Positions → *Group rollup*.
- **Being a super admin**, automatically — and that half can now be switched
  off under **Admin → Dashboard → All-stores rollup for admins**.

The switch only governs the automatic grant. A position with *Group rollup* on
keeps the rollup whether the switch is on or off, which is what makes it usable:
you can hand the rollup to the people who should have it and stop it following
every administrator around.

Both settings live in `app_settings` and default to on, so a missing row behaves
the way it did before the setting existed.

**Note** a person with the rollup granted but no store assignments still sees
"You don't have access to any dealerships yet" and nothing else — the dashboard
stops there before it reaches the rollup. That predates the switch.

## Colour

Four brand colours, and only the pairings the brand guide approves:

| | Hex | PMS |
| --- | --- | --- |
| Marble | `#e8ede8` | 642 C/U |
| Chambray | `#9eb2bf` | 2155 C/U |
| Slate | `#526c7f` | 7462 C/U |
| Obsidian | `#0d2133` | 296 C/U |

**Light is the Marble flood; dark — still the default — is the Slate flood.**

Where each colour lands was decided by measurement, not taste, because the
palette is narrow:

| on | Marble | Chambray | Slate | Obsidian |
| --- | --- | --- | --- | --- |
| **Marble** | — | 1.85 | 4.65 | 13.81 |
| **Chambray** | 1.85 | — | 2.51 | 7.47 |
| **Slate** | 4.65 | 2.51 | — | 2.97 |
| **Obsidian** | 13.81 | 7.47 | 2.97 | — |

Three consequences worth knowing before changing anything here:

**Dark floods the page with Slate but puts every card on Obsidian.** Chambray
is unusable as text on Slate (2.51) and comfortable on Obsidian (7.47), so the
cards buy back the whole muted range. A card on a Slate flood is itself an
approved pairing.

**Muted text has nowhere to hide.** A Slate ground needs luminance ≥ 0.807
before small text reaches 4.5, and Marble is 0.836 — so on the dark page,
anything visibly dimmer than Marble fails. Marble needs ≤ 0.147, and Slate is
0.141, so the light page has exactly one muted tone. `--n-400` and `--n-500`
are therefore the same colour in both themes, and hierarchy comes from size and
weight instead. That is not an oversight.

**The primary button carries its own label colour** (`--btn` / `--btn-ink`,
used through `.btn-primary`). A Slate button disappears on a Slate page and an
Obsidian one disappears into an Obsidian card; the only fill that stands clear
of both is Marble, and Marble cannot hold a white label. So the fill and the
label flip together — Obsidian on Marble in light, Marble on Obsidian in dark.

Nothing above required rewriting component classes. `@theme inline` remaps
Tailwind's `zinc` and `blue` scales onto CSS variables that change with the
theme, so all ~300 existing `text-zinc-500` / `bg-blue-600` utilities follow
the brand. Semantic colours — red, green, amber for alerts and budget pace —
are left alone, since they mean something other than "brand".

Every text run on the dashboard, store, entry and account pages was measured
against what is actually painted behind it, in both themes, and all of them
clear WCAG AA.

## Type

Three faces, none of which ship with the repo — they are licensed:

- **Monument Grotesk** — everything: body, labels, tables, buttons.
- **Compadre** — page titles only (`h1`), at its natural weight.
- **GT America Mono** — figures, email addresses, temporary passwords, the CSV
  paste box. Anything read a character at a time or compared down a column.

Drop the `.woff2` files into `public/fonts/` with the names in the `@font-face`
blocks at the top of `app/globals.css` and they take over on the next load.
Until then every rule falls through to Geist, which is still installed for
exactly that reason.

They are declared with hand-written `@font-face` rather than `next/font/local`
on purpose: that helper fails the **build** when a file is missing, which would
leave the site undeployable until the licences are sorted. A missing
`@font-face` is a silent fallback instead.

The logo is the **LAPIS wordmark alone** — `lapis-wordmark.png`, with
`lapis-wordmark-white.png` for dark backgrounds. The manufacturer marks were
cut off the all-brands lockup; they belong on a dealership sign, not in an app
header. The full lockup stays at `lapis-logo.png` if it is ever wanted.

The bird is **platinum on dark backgrounds, obsidian on light**, matching the
Launchpad. `Lapis-Platinum-Emblem.png` is a real file, made from the gold one
by rewriting its palette — the emblem is an indexed PNG, so the compressed
image data was copied through untouched and the two differ only in colour.

The favicon and the installed app icons are the **platinum bird on a 296 C
tile**, generated from the emblem rather than drawn, and each reuses the
framing of the file it replaced so only the colours changed. The manifest's
`background_color` and `theme_color` are 296 C to match, so the splash screen
no longer flashes white.

**The `?v=` on the manifest icon URLs is load-bearing.** An installed app keeps
its old icon indefinitely; bump it whenever the icons change or phones will
carry on showing the previous one.

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
