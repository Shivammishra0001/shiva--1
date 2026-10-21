// Sign-in, sign-out, current user, password change. Sign-in errors never reveal whether an email exists.
import { randomUUID } from 'node:crypto'
import { badRequest, unauthorized } from '../lib/errors.js'
import { burnPasswordCheck, hashPassword, passwordProblem, randomToken, sha256, verifyPassword } from '../lib/crypto.js'
import { validate, str, email } from '../lib/validate.js'
import { permissionsOf, rolesOf } from '../auth/access.js'
import { isTempSuspended } from '../lib/members.js'
import { writeAudit } from '../lib/audit.js'

const GENERIC = 'Email or password is incorrect.'

export const publicUser = (db, u) => ({
  id: u.id, name: u.name, email: u.email, status: u.status, mustChangePassword: !!u.mustChangePassword,
  roles: rolesOf(db, u).map((r) => ({ id: r.id, key: r.key, name: r.name })), permissions: [...permissionsOf(db, u)],
  createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null,
})

const cookie = (config, value, maxAgeSec) =>
  `${config.cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${config.production ? '; Secure' : ''}`

export function register(router, { store, config, limiters }) {
  router.post('/api/admin/auth/login', { public: true }, async ({ body, ip, requestId }) => {
    const { email: mail, password } = validate(body, { email: email(), password: str({ min: 1, max: 200, trim: false }) })
    limiters.loginIp.hit(ip) // throws 429 when this address tries too often
    limiters.loginEmail.hit(mail)
    // Wrong guesses lock only the address they came from, so someone else cannot lock the owner out.
    const key = `${ip}|${mail}`
    limiters.login.hit(key)
    const db = store.read()
    const user = db.users.find((u) => u.email === mail)
    const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false)
    // Accounts with no admin permissions (members) cannot use the admin sign-in. Same generic answer.
    if (!ok || !user || user.status !== 'active' || isTempSuspended(user) || permissionsOf(db, user).size === 0) {
      store.transaction((d) => writeAudit(d, { actor: user ? { id: user.id, email: user.email } : { id: null, email: mail }, action: 'auth.login', resource: 'session', outcome: 'failed', requestId, ip }))
      throw unauthorized(GENERIC)
    }
    limiters.login.reset(key)
    const token = randomToken()
    const maxMs = config.sessionMaxHours * 3_600_000
    const result = store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      u.lastLoginAt = new Date().toISOString()
      d.sessions = d.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now()) // drop expired sessions
      d.sessions.push({ id: randomUUID(), userId: u.id, tokenHash: sha256(token), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + maxMs).toISOString(), ip })
      writeAudit(d, { actor: u, action: 'auth.login', resource: 'session', requestId, ip })
      return publicUser(d, u)
    })
    return { body: { user: result }, headers: { 'Set-Cookie': cookie(config, token, Math.floor(maxMs / 1000)) } }
  })

  router.post('/api/admin/auth/logout', ({ session, auditIn }) => {
    store.transaction((d) => { d.sessions = d.sessions.filter((s) => s.id !== session.id); auditIn(d, 'auth.logout', 'session', session.id) })
    return { body: { ok: true }, headers: { 'Set-Cookie': cookie(config, '', 0) } }
  })

  router.get('/api/admin/auth/me', ({ user }) => ({ user: publicUser(store.read(), user) }))

  router.post('/api/admin/auth/change-password', async ({ user, session, body, auditIn }) => {
    const { currentPassword, newPassword } = validate(body, { currentPassword: str({ min: 1, max: 200, trim: false }), newPassword: str({ min: 1, max: 200, trim: false }) })
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw badRequest('Your current password is incorrect.', { currentPassword: 'Incorrect.' })
    const problem = passwordProblem(newPassword)
    if (problem) throw badRequest(problem, { newPassword: problem })
    if (newPassword === currentPassword) throw badRequest('Choose a new password.', { newPassword: 'Must be different.' })
    const passwordHash = await hashPassword(newPassword)
    store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      u.passwordHash = passwordHash
      u.mustChangePassword = false
      u.passwordChangedAt = new Date().toISOString()
      limiters.login.resetWhere((k) => k.endsWith(`|${u.email}`)) // changing your password lifts any sign-in lock
      d.sessions = d.sessions.filter((s) => s.userId !== u.id || s.id === session.id) // sign out every other device
      auditIn(d, 'auth.password_change', 'user', u.id)
    })
    return { ok: true }
  })
}
