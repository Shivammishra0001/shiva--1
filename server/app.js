// Builds the API: router, authentication/authorization context and all modules.
// Adding a module = create server/modules/<name>.js exporting register(router), then add it to MODULES below.
import { config as defaultConfig } from './config.js'
import { createStore } from './lib/store.js'
import { createRouter, createHandler, parseCookies } from './lib/http.js'
import { forbidden, unauthorized } from './lib/errors.js'
import { sha256 } from './lib/crypto.js'
import { writeAudit } from './lib/audit.js'
import { can } from './auth/access.js'
import { createLimiter } from './lib/rateLimit.js'
import { createMailer } from './lib/mailer.js'
import { createStorage } from './lib/storage.js'
import { isPostingRestricted, isTempSuspended, pendingPolicies } from './lib/members.js'
import { permissionsOf } from './auth/access.js'
import { applyRetention } from './lib/retention.js'
import { seedAll } from './seed.js'
import * as authModule from './modules/auth.js'
import * as dashboardModule from './modules/dashboard.js'
import * as usersModule from './modules/users.js'
import * as rolesModule from './modules/roles.js'
import * as communitiesModule from './modules/communities.js'
import * as eventsModule from './modules/events.js'
import * as projectsModule from './modules/projects.js'
import * as enquiriesModule from './modules/enquiries.js'
import * as contentModule from './modules/content.js'
import * as reportsModule from './modules/reports.js'
import * as auditModule from './modules/audit.js'
import * as settingsModule from './modules/settings.js'
import * as publicModule from './modules/public.js'
import * as memberAuthModule from './modules/memberAuth.js'
import * as communityModule from './modules/community.js'
import * as moderationModule from './modules/moderation.js'
import * as profileModule from './modules/profile.js'

const MODULES = [authModule, dashboardModule, usersModule, rolesModule, communitiesModule, eventsModule, projectsModule, enquiriesModule, contentModule, reportsModule, auditModule, settingsModule, publicModule, memberAuthModule, communityModule, moderationModule, profileModule]

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])
const ALLOWED_WHILE_PASSWORD_CHANGE = new Set(['/api/admin/auth/me', '/api/admin/auth/logout', '/api/admin/auth/change-password'])

export function createApp({ config = defaultConfig, store = createStore(config.dataFile), log, mailer = createMailer(config), storage = createStorage(config) } = {}) {
  seedAll(store, config)
  applyRetention(store, config)
  const router = createRouter()
  const limiters = {
    login: createLimiter({ max: config.loginMaxAttempts, windowMs: config.loginWindowMinutes * 60_000 }),
    loginEmail: createLimiter({ max: config.loginEmailMax, windowMs: config.loginWindowMinutes * 60_000 }),
    loginIp: createLimiter({ max: config.loginIpMax, windowMs: config.loginWindowMinutes * 60_000 }),
    publicForm: createLimiter({ max: 10, windowMs: 60 * 60_000 }),
    register: createLimiter({ max: config.registerMax ?? 10, windowMs: 60 * 60_000 }),
    forgot: createLimiter({ max: config.forgotMax ?? 5, windowMs: 60 * 60_000 }),
    verify: createLimiter({ max: 10, windowMs: 60 * 60_000 }),
    report: createLimiter({ max: 20, windowMs: 60 * 60_000 }),
    content: createLimiter({ max: config.contentMax ?? 40, windowMs: 60 * 60_000 }),
    appeal: createLimiter({ max: 10, windowMs: 60 * 60_000 }),
  }
  const deps = { store, config, limiters, mailer, storage }
  MODULES.forEach((m) => m.register(router, deps))

  async function context({ req, res, url, route, params, body, requestId }) {
    const sock = req.socket.remoteAddress || ''
    const ip = config.trustProxy ? (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || sock) : sock
    const base = { req, res, url, query: Object.fromEntries(url.searchParams), params, body, requestId, ip, store, config, limiters, user: null }
    const audit = (action, resource, resourceId, changes, outcome = 'success') =>
      store.transaction((db) => writeAudit(db, { actor: base.user, action, resource, resourceId, changes, outcome, requestId, ip }))
    base.audit = audit
    // Use inside store.transaction so the audit record commits (or rolls back) with the change itself.
    base.auditIn = (db, action, resource, resourceId, changes, outcome = 'success') => writeAudit(db, { actor: base.user, action, resource, resourceId, changes, outcome, requestId, ip })
    if (route.public) return base
    if (route.optional) { try { return await authenticate() } catch (e) { if (e.status === 401) return base; throw e } }
    return authenticate()

    async function authenticate() {
    const isAdminRoute = url.pathname.startsWith('/api/admin/')

    const db = store.read()
    const token = parseCookies(req.headers.cookie)[config.cookieName]
    const session = token && db.sessions.find((s) => s.tokenHash === sha256(token))
    const now = Date.now()
    const idleMs = (db.settings?.['session.idleMinutes'] ?? config.sessionIdleMinutes) * 60_000
    if (!session || Date.parse(session.expiresAt) < now || now - Date.parse(session.lastSeenAt) > idleMs) throw unauthorized('Your session has expired. Sign in again.')
    const user = db.users.find((u) => u.id === session.userId)
    if (!user || user.status !== 'active') throw unauthorized('Your account is not active.')
    base.user = user
    base.session = session

    if (MUTATING.has(req.method)) {
      // CSRF: SameSite=Strict cookie plus a custom header that cross-site forms cannot send, and an Origin check.
      if (!['dscw-admin', 'dscw-web'].includes(req.headers['x-requested-with'])) throw forbidden('Request was blocked (missing header).')
      const origin = req.headers.origin
      if (origin && new URL(origin).host !== req.headers.host && !config.trustedOrigins?.includes(origin)) throw forbidden('Request was blocked (origin).')
    }
    // Member accounts hold no permissions, so they get nothing from the admin API except their own session calls.
    if (isAdminRoute && permissionsOf(db, user).size === 0 && !/\/auth\/(me|logout|change-password)\/?$/.test(url.pathname)) throw forbidden('This account does not have admin access.')
    if (isTempSuspended(user)) throw forbidden('Your account is temporarily suspended.', 'suspended')
    if (route.participate) {
      // Community and Cohort participation: policies accepted, email verified when enforced, not restricted.
      if (pendingPolicies(db, user).length) throw forbidden('Please accept the updated policies to continue.', 'policy_required')
      if (config.requireEmailVerification && !user.emailVerified) throw forbidden('Verify your email address to participate.', 'verification_required')
      if (route.write && isPostingRestricted(user)) throw forbidden('Posting is temporarily restricted on your account.', 'restricted')
    }
    if (user.mustChangePassword && !ALLOWED_WHILE_PASSWORD_CHANGE.has(url.pathname.replace(/\/$/, ''))) {
      throw forbidden('Change your password before continuing.')
    }
    if (route.perm && !can(db, user, route.perm)) {
      if (MUTATING.has(req.method)) audit('access.denied', 'permission', route.perm, undefined, 'denied')
      throw forbidden()
    }
    if (now - Date.parse(session.lastSeenAt) > 60_000) store.transaction((d) => { const s = d.sessions.find((x) => x.id === session.id); if (s) s.lastSeenAt = new Date().toISOString() })
    return base
    }
  }

  return { handler: createHandler({ router, context, log }), store, router }
}
