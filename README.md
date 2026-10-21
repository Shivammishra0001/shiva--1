# Data Science Co-Working Space

Public website (React + Vite, plain CSS) plus an admin panel with its own small API.

```bash
pnpm install
pnpm dev            # website + admin + API on http://localhost:5173
```

| Address | What |
|---|---|
| `/` , `/about.html`, `/contact.html`, `/community.html`, `/cohort.html`, `/market.html` | Public site (static data in `src/data/`) |
| `/signin.html` | Member sign in / create account / reset password (`?next=` returns people to the page they wanted) |
| `/legal.html?doc=terms\|privacy\|guidelines` | Policy pages (drafts for legal review) |
| `/profile.html` | A member's own profile: communities, cohorts and events, activity, settings (`?u=<id>` shows another member's profile if their privacy settings allow) |
| `/community.html`, `/cohort.html` | Members only: signed-out visitors are sent to sign in |
| `/admin` | Admin panel (sign in required) |
| `/api/admin/*` | Admin API (session + permission checked on every request) |
| `/api/public/*` | Read-only published data and public forms |

## Admin sign-in

The first Super Admin is created from `server/.env` (git-ignored) the first time the API starts with an empty database:

```
ADMIN_EMAIL=...        ADMIN_PASSWORD=...        ADMIN_NAME=...
```

The `.env` password is used **only when the account is first created**. Editing it later changes nothing by itself. To set a new password from `.env`: stop the server, edit `ADMIN_PASSWORD`, run `pnpm admin:reset`, then start the server again. Otherwise change it from the account menu after signing in.

## Folder map

```
admin.html                 entry page for /admin
src/admin/                 admin UI (React)
  AdminApp.jsx             sign-in gate + route table
  Shell.jsx  nav.js        layout, sidebar, menu items (one line per page)
  api.js  auth.jsx  router.jsx  ui.jsx   API client, session, router, shared components
  admin.css                all admin styles (colour tokens at the top)
  pages/                   one file per screen (Users, Roles, Resources, Content, ...)
server/                    admin API (Node built-ins only, no packages)
  app.js                   builds the router, checks session + permission for every route
  config.js  .env          settings and first-admin credentials
  seed.js                  roles + first admin + copy of src/data content on first start
  auth/permissions.js      permission catalogue and role templates
  auth/access.js           who may do what (privilege escalation, last Super Admin)
  lib/                     store (database), validation, errors, audit, rate limit, http
  modules/                 one file per feature: users, roles, communities, events, projects, ...
    memberAuth.js          register, sign in, verify email, reset password, policy acceptance
    community.js           member posts, comments, reports, appeals (screened before publishing)
    moderation.js          staff queue, decisions, appeals, escalated evidence, disclosure records
    profile.js             own profile, avatar, privacy, joins/enrolments/registrations, activity (/api/me/*)
  policies.js              versioned policy text (bump `version` to require re-acceptance)
  lib/contentRules.js      the content-screening rules (edit here)
  tests/                   `pnpm test:server`
  data/db.json             local database (git-ignored)
src/member/                sign-in panel, session store, Community/Cohort gate (public site)
src/profile/               profile page (header, edit dialog, sections)
```

## Member accounts and moderation

- Members use the same `users` table as admins (role **Member**, no permissions). Registration can never set roles.
- Email verification and password reset links need a mail provider. None is connected, so by default nothing is emailed and `REQUIRE_EMAIL_VERIFICATION` is off. For local testing set `DEV_OUTBOX=true` in `server/.env`: links are written to `server/data/dev-outbox.jsonl` (never to the console).
- Posts and comments are screened on the server before they appear. Flagged content is held for a person; nothing is deleted or suspended automatically.
- Staff handle reports in **Admin > Moderation**.

## Common changes

- **New admin page:** add `src/admin/pages/X.jsx`, add it to `PAGES` in `AdminApp.jsx` and one line in `nav.js`.
- **New API feature:** add `server/modules/x.js` exporting `register(router, deps)`, add it to `MODULES` in `server/app.js`, add its permissions to `server/auth/permissions.js`.
- **New field on communities / cohorts / events / projects:** add it to the schema in `server/modules/<name>.js` and to the `fields` list in `src/admin/pages/Resources.jsx`.
- **Use a real database:** only `server/lib/store.js` touches storage (`read()` and `transaction(fn)`).

## Scripts

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm test:server` · `pnpm api` (API alone on port 8787)

## Before going live

See `server/SECURITY.md`.
# data-science-new
# data-science-new
