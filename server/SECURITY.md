# Security notes for the admin panel

What is built in
- Passwords: scrypt with a random salt; minimum 12 characters with upper, lower case and a number. Hashes never leave the server.
- Sessions: random token in an HttpOnly, SameSite=Strict cookie (Secure when NODE_ENV=production). Only a SHA-256 of the token is stored. Idle timeout (setting) and a 12 hour maximum.
- CSRF: SameSite=Strict, a required `X-Requested-With: dscw-admin` header on every write, and an Origin check.
- Authorization: every protected route names one permission in its definition (`perm:`); `app.js` checks it before the handler runs. Hiding menu items is only cosmetic.
- Privilege escalation: you can only grant or edit permissions you hold; only a Super Admin can change a Super Admin; you cannot change your own roles; the last active Super Admin is protected.
- Input: every body is validated against a schema; unknown fields are dropped (mass assignment).
- Sign-in: generic errors, constant-time check for unknown emails, per-email and per-IP limits.
- Audit log: append-only (there is no edit or delete route), no passwords or tokens, before/after for changed fields.
- Settings changes and CSV exports are permission-checked and audited; settings need the current password.

Before production
1. Run the API behind HTTPS and set `NODE_ENV=production` (turns on Secure cookies).
2. If behind a reverse proxy you control, set `TRUST_PROXY=true`; otherwise the per-IP limit sees only the proxy.
3. Serve `/admin` with a Content-Security-Policy and `X-Frame-Options: DENY` from your host (static hosting cannot be set from this repo). In production hosting, rewrite `/admin/*` to `/admin.html`.
4. Replace the JSON file store (`server/lib/store.js`) with a real database and take backups. The file store is single-process and is not meant for heavy concurrent use.
5. Rate limits are in memory and reset on restart; use a shared store if you run more than one server process.
6. Connect an email provider so password resets can be sent as links instead of one-time passwords, and so event notices can really be delivered.
7. Add file storage before enabling uploads. No upload endpoint exists yet.
8. Rotate the first admin password and keep `server/.env` out of version control (it is git-ignored).

Member accounts, moderation and legal escalation
- Registration answers identically whether or not the email exists and never signs anyone in; the browser signs in afterwards. Reset requests answer identically too.
- Phone numbers are stored (E.164) but NOT verified: no verification provider is configured.
- Email verification is enforced only when `REQUIRE_EMAIL_VERIFICATION=true` and a mail provider can deliver the link (see `server/lib/mailer.js`).
- Policy acceptance records user, policy, version and time. Changing a version in `server/policies.js` makes every member accept it again before they can post.
- The content screening in `server/lib/contentRules.js` is a small rules layer. It is NOT a reliable detector: it misses things and can flag innocent posts. It only holds content for a person; a person decides. Consider a proper moderation service before launch.
- Reporter identity is hidden from members and from staff who lack `moderation.evidence`. Resolved reports are anonymised after `REPORT_RETENTION_DAYS` (default 365).
- Appeals are decided by a different reviewer than the original moderator.
- Escalation preserves a restricted copy of the content. Viewing it is logged. Recording a disclosure only writes a record: NOTHING is sent to the police or anyone else automatically. Define the real procedure with qualified legal counsel for your jurisdiction.
- The policy texts are drafts, labelled as such, and have not been reviewed by a lawyer.

Profiles, memberships and activity
- `/api/me/*` routes act on the caller only and take no user id, so one member cannot reach another's private data. Admin views use `/api/admin/users/:id/participation` and need `users.read`; the phone number is masked without `users.update`, and moderation history needs `moderation.review`.
- Profile edits accept an explicit list of fields. Role, status, verification, email and phone cannot be changed there. Email and phone changes need a verification workflow this site does not have yet.
- Profile visibility (private / members / public) and the show-email, show-location, show-interests and show-communities switches are enforced on the server. Phone numbers are never returned. A private profile and a missing one give the same 404.
- Avatars: PNG, JPEG or WebP only (checked by file contents, not the declared type; SVG is refused), 400 KB maximum, stored in `server/data/uploads/avatars` (outside the web root) and served only through the profile visibility check. There is no cloud storage configured; replace `server/lib/storage.js` to use one.
- Memberships, enrolments and event registrations are separate records with one record per person per item. Activity is a separate member-only log; the admin audit log is never shown to members.
- Account deactivation is a request recorded as an enquiry. Nothing is deactivated automatically.
