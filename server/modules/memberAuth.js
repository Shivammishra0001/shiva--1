// Member accounts: register, sign in, verify email, reset password, policy acceptance and profile.
// Reuses the same users table, sessions, hashing and audit log as the admin panel. Members get the "member" role, which
// grants no permissions. Registration input can never set roles.
import { randomUUID } from 'node:crypto'
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js'
import { burnPasswordCheck, hashPassword, passwordProblem, randomToken, sha256, verifyPassword } from '../lib/crypto.js'
import { bool, str, validate, email } from '../lib/validate.js'
import { writeAudit } from '../lib/audit.js'
import { POLICIES, POLICY_IDS, currentVersions } from '../policies.js'
import { isTempSuspended, memberView, pendingPolicies, recordAcceptance } from '../lib/members.js'
import { sessionCookie, startSession } from '../lib/session.js'
import { cleanText, screenContent } from '../lib/contentRules.js'

const GENERIC = 'Email or password is incorrect.'
const VERIFY_HOURS = 48
const RESET_MINUTES = 60

// +, then 8 to 15 digits (E.164). Spaces, dashes and brackets are tolerated and removed.
export const normalisePhone = (v) => String(v ?? '').replace(/[\s\-().]/g, '')
const PHONE = /^\+[1-9]\d{7,14}$/

function issueToken(db, userId, type, ttlMs) {
  const token = randomToken(32)
  db.tokens = db.tokens.filter((t) => Date.parse(t.expiresAt) > Date.now() && !(t.userId === userId && t.type === type)) // one live token per type
  db.tokens.push({ id: randomUUID(), type, userId, hash: sha256(token), expiresAt: new Date(Date.now() + ttlMs).toISOString(), usedAt: null })
  return token
}
const useToken = (db, token, type) => {
  const t = db.tokens.find((x) => x.type === type && x.hash === sha256(String(token)) && !x.usedAt && Date.parse(x.expiresAt) > Date.now())
  if (t) t.usedAt = new Date().toISOString()
  return t
}

export function register(router, { store, config, limiters, mailer }) {
  const origin = (req) => `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`

  /* ---------- public policy documents ---------- */
  router.get('/api/public/policies', { public: true }, () => ({ items: POLICY_IDS.map((id) => ({ id, title: POLICIES[id].title, version: POLICIES[id].version, effective: POLICIES[id].effective, draft: POLICIES[id].draft })) }))
  router.get('/api/public/policies/:id', { public: true }, ({ params }) => { if (!POLICIES[params.id]) throw notFound('Policy not found.'); return { policy: POLICIES[params.id] } })

  /* ---------- registration ---------- */
  // Always answers the same way, whether or not the email already has an account, and never signs the user in.
  // The browser signs in afterwards; if the email already existed that sign-in fails with the generic message.
  router.post('/api/auth/register', { public: true }, async ({ body, req, ip, requestId }) => {
    limiters.register.hit(`reg:${ip}`)
    const data = validate({ ...body, phone: normalisePhone(body?.phone) }, {
      name: str({ min: 2, max: 80 }), email: email(), phone: str({ pattern: PHONE, patternMessage: 'Enter a phone number with country code, like +91 99953 43366.' }),
      password: str({ min: 1, max: 200, trim: false }), confirmPassword: str({ min: 1, max: 200, trim: false }),
      acceptTerms: bool(), acceptGuidelines: bool(), acceptPrivacy: bool(),
    })
    const errors = {}
    const problem = passwordProblem(data.password)
    if (problem) errors.password = problem
    if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
    if (data.acceptTerms !== true) errors.acceptTerms = 'You must accept the Terms and Conditions.'
    if (data.acceptGuidelines !== true) errors.acceptGuidelines = 'You must agree to follow the Community Guidelines.'
    if (data.acceptPrivacy !== true) errors.acceptPrivacy = 'You must acknowledge the Privacy Policy.'
    const shown = body?.policyVersions
    if (shown && POLICY_IDS.some((id) => shown[id] !== POLICIES[id].version)) throw conflict('The policies were updated. Reload the page and review them again.', { policyVersions: 'Out of date.' })
    if (Object.keys(errors).length) throw badRequest('Check the highlighted fields.', errors)

    const passwordHash = await hashPassword(data.password) // same work whether or not the account exists
    let token = null
    store.transaction((d) => {
      if (d.users.some((u) => u.email === data.email)) { writeAudit(d, { actor: null, action: 'member.register', resource: 'user', outcome: 'duplicate', requestId, ip }); return }
      const role = d.roles.find((r) => r.key === 'member')
      const user = { id: randomUUID(), name: data.name, email: data.email, phone: data.phone, phoneVerified: false, emailVerified: false, passwordHash, roleIds: [role.id], status: 'active', mustChangePassword: false, createdAt: new Date().toISOString() }
      d.users.push(user)
      recordAcceptance(d, user) // terms + privacy + guidelines, with the version and time
      token = issueToken(d, user.id, 'verify', VERIFY_HOURS * 3_600_000)
      writeAudit(d, { actor: user, action: 'member.register', resource: 'user', resourceId: user.id, requestId, ip })
    })
    if (token) await mailer.send({ to: data.email, type: 'verify-email', link: `${origin(req)}/signin.html?verify=${token}` })
    return { status: 201, body: { ok: true, verificationRequired: config.requireEmailVerification } }
  })

  /* ---------- sign in / out ---------- */
  router.post('/api/auth/login', { public: true }, async ({ body, ip, requestId }) => {
    const { email: mail, password } = validate(body, { email: email(), password: str({ min: 1, max: 200, trim: false }) })
    limiters.loginIp.hit(`m:${ip}`)
    limiters.loginEmail.hit(`m:${mail}`)
    limiters.login.hit(`m:${ip}|${mail}`)
    const user = store.read().users.find((u) => u.email === mail)
    const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false)
    if (!ok || user.status === 'deleted') {
      store.transaction((d) => writeAudit(d, { actor: user ? { id: user.id } : null, action: 'auth.login', resource: 'member_session', outcome: 'failed', requestId, ip }))
      throw unauthorized(GENERIC)
    }
    // The password was right, so it is now safe to explain account status.
    if (user.status === 'suspended' || isTempSuspended(user)) throw forbidden(isTempSuspended(user) ? `Your account is suspended until ${new Date(user.suspendedUntil).toDateString()}.` : 'Your account is suspended. Use the Contact page to appeal.', 'suspended')
    limiters.login.reset(`m:${ip}|${mail}`)
    const result = store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      u.lastLoginAt = new Date().toISOString()
      const s = startSession(d, u, config, ip)
      writeAudit(d, { actor: u, action: 'auth.login', resource: 'member_session', requestId, ip })
      return { cookie: s.cookie, user: memberView(d, u) }
    })
    return { body: { user: result.user }, headers: { 'Set-Cookie': result.cookie } }
  })

  router.post('/api/auth/logout', ({ session, auditIn }) => {
    store.transaction((d) => { d.sessions = d.sessions.filter((s) => s.id !== session.id); auditIn(d, 'auth.logout', 'member_session', session.id) })
    return { body: { ok: true }, headers: { 'Set-Cookie': sessionCookie(config, '', 0) } }
  })

  // Answers { user: null } (not an error) when nobody is signed in, so every page can ask quietly.
  router.get('/api/auth/me', { optional: true }, ({ user }) => ({ user: user ? memberView(store.read(), user) : null, versions: currentVersions(), verificationRequired: config.requireEmailVerification }))

  /* ---------- policy re-acceptance ---------- */
  router.post('/api/auth/accept-policies', ({ body, user, auditIn }) => {
    const { accept } = validate(body, { accept: bool() })
    if (accept !== true) throw badRequest('You must accept to continue.')
    const shown = body.versions ?? {}
    return store.transaction((d) => {
      const pending = pendingPolicies(d, user)
      if (pending.some((p) => shown[p.id] !== p.version)) throw conflict('The policies changed again. Reload and review them.')
      recordAcceptance(d, user, pending.map((p) => p.id))
      auditIn(d, 'member.accept_policies', 'user', user.id, { accepted: { from: null, to: pending.map((p) => `${p.id}@${p.version}`) } })
      return { user: memberView(d, d.users.find((u) => u.id === user.id)) }
    })
  })

  /* ---------- email verification ---------- */
  router.post('/api/auth/verify-email', { public: true }, ({ body, ip, requestId }) => {
    limiters.verify.hit(`v:${ip}`)
    const { token } = validate(body, { token: str({ min: 10, max: 200 }) })
    return store.transaction((d) => {
      const t = useToken(d, token, 'verify')
      if (!t) throw badRequest('This verification link is invalid or has expired. Request a new one.')
      const u = d.users.find((x) => x.id === t.userId)
      u.emailVerified = true
      writeAudit(d, { actor: u, action: 'member.verify_email', resource: 'user', resourceId: u.id, requestId, ip })
      return { ok: true }
    })
  })

  router.post('/api/auth/resend-verification', async ({ user, req, ip }) => {
    limiters.verify.hit(`rv:${user.id}`)
    if (user.emailVerified) return { ok: true }
    let token
    store.transaction((d) => { token = issueToken(d, user.id, 'verify', VERIFY_HOURS * 3_600_000) })
    await mailer.send({ to: user.email, type: 'verify-email', link: `${origin(req)}/signin.html?verify=${token}` })
    return { ok: true, ip: undefined }
  })

  /* ---------- password reset (same answer whether or not the email exists) ---------- */
  router.post('/api/auth/forgot-password', { public: true }, async ({ body, req, ip, requestId }) => {
    limiters.forgot.hit(`f:${ip}`)
    const { email: mail } = validate(body, { email: email() })
    limiters.forgot.hit(`f:${mail}`)
    let token = null
    store.transaction((d) => {
      const u = d.users.find((x) => x.email === mail && x.status === 'active')
      if (!u) return
      token = issueToken(d, u.id, 'reset', RESET_MINUTES * 60_000)
      writeAudit(d, { actor: u, action: 'member.reset_requested', resource: 'user', resourceId: u.id, requestId, ip })
    })
    if (token) await mailer.send({ to: mail, type: 'reset-password', link: `${origin(req)}/signin.html?reset=${token}` })
    return { ok: true, message: 'If that email has an account, we have sent reset instructions.' }
  })

  router.post('/api/auth/reset-password', { public: true }, async ({ body, ip, requestId }) => {
    limiters.verify.hit(`rp:${ip}`)
    const { token, password } = validate(body, { token: str({ min: 10, max: 200 }), password: str({ min: 1, max: 200, trim: false }) })
    const problem = passwordProblem(password)
    if (problem) throw badRequest(problem, { password: problem })
    const passwordHash = await hashPassword(password)
    return store.transaction((d) => {
      const t = useToken(d, token, 'reset')
      if (!t) throw badRequest('This reset link is invalid or has expired. Request a new one.')
      const u = d.users.find((x) => x.id === t.userId)
      u.passwordHash = passwordHash
      u.mustChangePassword = false
      d.sessions = d.sessions.filter((s) => s.userId !== u.id) // sign out everywhere
      limiters.login.resetWhere((k) => k.endsWith(`|${u.email}`)) // a reset lifts any sign-in lock
      writeAudit(d, { actor: u, action: 'member.reset_completed', resource: 'user', resourceId: u.id, requestId, ip })
      return { ok: true }
    })
  })

  router.post('/api/auth/notices/:id/read', ({ params, user }) => {
    store.transaction((d) => { const n = d.notices.find((x) => x.id === params.id && x.userId === user.id); if (n) n.read = true })
    return { ok: true }
  })
}
