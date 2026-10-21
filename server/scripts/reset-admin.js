// Reset the admin password from server/.env:   pnpm admin:reset
// Sets the password of ADMIN_EMAIL to ADMIN_PASSWORD (creating the Super Admin if that email has no account),
// reactivates it, ends its sessions and records the reset in the audit log.
// Stop `pnpm dev` / `pnpm api` first: a running server keeps its own copy of the data and would overwrite this change.
import { config } from '../config.js'
import { createApp } from '../app.js'
import { createStore } from '../lib/store.js'
import { hashPasswordSync, passwordProblem } from '../lib/crypto.js'
import { writeAudit } from '../lib/audit.js'

const fail = (m) => { console.error(`\nNot changed: ${m}\n`); process.exit(1) }
if (!config.adminEmail || !config.adminPassword) fail('set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.')
const problem = passwordProblem(config.adminPassword)
if (problem) fail(`ADMIN_PASSWORD is too weak. ${problem}`)

// Refuse if a server is running (the usual ports), because it would undo the change.
for (const port of [5173, 8787, 4173]) {
  try { await fetch(`http://127.0.0.1:${port}/api/public/policies`, { signal: AbortSignal.timeout(700) }); fail(`a server is running on port ${port}. Stop it (Ctrl+C), run this again, then start it.`) } catch (e) { if (e.name !== 'TypeError' && e.name !== 'TimeoutError' && e.name !== 'AbortError') throw e }
}

const store = createStore(config.dataFile)
createApp({ config, store, log: () => {} }) // runs the normal start-up seeding (roles, first admin)
const email = config.adminEmail.trim().toLowerCase()
const result = store.transaction((d) => {
  const superRole = d.roles.find((r) => r.key === 'super_admin')
  let u = d.users.find((x) => x.email === email)
  const created = !u
  if (!u) { u = { id: crypto.randomUUID(), name: config.adminName, email, roleIds: [], createdAt: new Date().toISOString() }; d.users.push(u) }
  u.passwordHash = hashPasswordSync(config.adminPassword)
  u.mustChangePassword = false
  u.status = 'active'
  delete u.suspendedUntil; delete u.suspendedReason; delete u.deletedAt
  if (!u.roleIds.includes(superRole.id)) u.roleIds.push(superRole.id)
  d.sessions = d.sessions.filter((s) => s.userId !== u.id)
  writeAudit(d, { actor: null, action: 'admin.password_reset_cli', resource: 'user', resourceId: u.id, outcome: 'success' })
  return { created }
})
console.log(`\n${result.created ? 'Created' : 'Reset'} the Super Admin account for ${email}.\nSign in at /admin with ADMIN_PASSWORD from server/.env, then change it from the account menu.\n`)
