// User management. Passwords and hashes never leave the server; resets issue a one-time temporary password.
import { randomUUID } from 'node:crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { hashPassword, temporaryPassword } from '../lib/crypto.js'
import { diff } from '../lib/audit.js'
import { email, list, str, validate } from '../lib/validate.js'
import { matches, paginate, sortBy } from '../lib/list.js'
import { participationOf } from './profile.js'
import { settingsOf } from '../lib/members.js'
import { assertCanAssignRoles, assertCanManageUser, assertNotLastSuperAdmin, can, rolesOf } from '../auth/access.js'

const view = (db, u) => ({
  id: u.id, name: u.name, email: u.email, status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null,
  mustChangePassword: !!u.mustChangePassword, roles: rolesOf(db, u).map((r) => ({ id: r.id, key: r.key, name: r.name })), suspendedReason: u.suspendedReason ?? null,
})
const target = (db, id) => { const u = db.users.find((x) => x.id === id); if (!u) throw notFound('User not found.'); return u }
const snapshot = (u) => ({ name: u.name, status: u.status, roleIds: u.roleIds })
const revokeSessions = (db, userId) => { db.sessions = db.sessions.filter((s) => s.userId !== userId) }

export function register(router, { store }) {
  router.get('/api/admin/users', { perm: 'users.read' }, ({ query }) => {
    const db = store.read()
    const from = query.createdFrom ? Date.parse(query.createdFrom) : null
    const to = query.createdTo ? Date.parse(query.createdTo) + 86_400_000 : null
    let rows = db.users
      .filter((u) => (query.status ? u.status === query.status : u.status !== 'deleted'))
      .filter((u) => !query.role || u.roleIds.includes(query.role))
      .filter((u) => !query.community || db.memberships.some((m) => m.userId === u.id && m.slug === query.community && m.status === 'active'))
      .filter((u) => !query.cohort || db.enrollments.some((e) => e.userId === u.id && e.slug === query.cohort && e.status === 'enrolled'))
      .filter((u) => (from ? Date.parse(u.createdAt) >= from : true) && (to ? Date.parse(u.createdAt) < to : true))
      .filter(matches(query, ['name', 'email']))
    rows = sortBy(rows, query, ['name', 'email', 'createdAt', 'lastLoginAt'], 'createdAt')
    const page = paginate(rows, query)
    return { ...page, items: page.items.map((u) => view(db, u)) }
  })

  router.get('/api/admin/users/:id', { perm: 'users.read' }, ({ params, user }) => {
    const db = store.read()
    const u = target(db, params.id)
    const history = can(db, user, 'audit.read')
      ? db.auditLogs.filter((a) => a.resourceId === u.id || a.actorId === u.id).slice(-25).reverse() : null
    return { user: view(db, u), activity: history, sessions: db.sessions.filter((s) => s.userId === u.id).length }
  })

  // What a person takes part in. Needs users.read; moderation history also needs moderation.review, and the phone number
  // is shown in full only with users.update. No passwords, tokens or private messages are ever included.
  router.get('/api/admin/users/:id/participation', { perm: 'users.read' }, ({ params, user }) => {
    const db = store.read()
    const u = target(db, params.id)
    const mask = (p) => (p ? `${p.slice(0, 3)}${'•'.repeat(Math.max(0, p.length - 5))}${p.slice(-2)}` : null)
    const parts = participationOf(db, u.id)
    return {
      profile: {
        name: u.name, email: u.email, emailVerified: !!u.emailVerified, phone: can(db, user, 'users.update') ? u.phone ?? null : mask(u.phone), username: u.username ?? null, headline: u.headline ?? '',
        bio: u.bio ?? '', bioStatus: u.bioStatus ?? 'published', location: u.location ?? '', interests: u.interests ?? [], skills: u.skills ?? [], hasAvatar: !!u.avatar,
        visibility: settingsOf(u).visibility, status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null,
      },
      ...parts,
      posts: db.posts.filter((p) => p.authorId === u.id).map((p) => ({ id: p.id, space: p.communitySlug, status: p.status, createdAt: p.createdAt, preview: p.content.slice(0, 80) })).slice(-20).reverse(),
      counts: { posts: db.posts.filter((p) => p.authorId === u.id).length, comments: db.comments.filter((c) => c.authorId === u.id).length, projects: 0 },
      moderation: can(db, user, 'moderation.review') ? db.actions.filter((a) => a.targetUserId === u.id).map((a) => ({ id: a.id, type: a.type, policy: a.policy, at: a.at, until: a.until ?? null, appealStatus: a.appealStatus })) : null,
    }
  })

  router.post('/api/admin/users', { perm: 'users.create' }, async ({ body, user, auditIn }) => {
    const data = validate(body, { name: str({ min: 2, max: 80 }), email: email(), roleIds: list(str({ max: 64 }), { optional: true, max: 8 }) })
    const roleIds = data.roleIds ?? []
    const db = store.read()
    if (db.users.some((u) => u.email === data.email)) throw conflict('An account with this email already exists.', { email: 'Already in use.' })
    assertCanAssignRoles(db, user, roleIds)
    const temp = temporaryPassword()
    const passwordHash = await hashPassword(temp)
    const created = store.transaction((d) => {
      const u = { id: randomUUID(), name: data.name, email: data.email, passwordHash, roleIds, status: 'active', mustChangePassword: true, createdAt: new Date().toISOString(), createdBy: user.id }
      d.users.push(u)
      auditIn(d, 'user.create', 'user', u.id, { email: { from: null, to: u.email }, roleIds: { from: null, to: roleIds } })
      return view(d, u)
    })
    // Shown once to the admin so it can be passed on securely. It must be changed at first sign-in.
    return { status: 201, body: { user: created, temporaryPassword: temp } }
  })

  router.patch('/api/admin/users/:id', { perm: 'users.update' }, ({ params, body, user, auditIn }) => {
    const data = validate(body, { name: str({ min: 2, max: 80 }), roleIds: list(str({ max: 64 }), { max: 8 }) }, { partial: true })
    return store.transaction((d) => {
      const u = target(d, params.id)
      assertCanManageUser(d, user, u)
      const before = snapshot(u)
      if (data.roleIds) {
        if (u.id === user.id) throw forbidden('You cannot change your own roles.')
        const changed = [...data.roleIds.filter((r) => !u.roleIds.includes(r)), ...u.roleIds.filter((r) => !data.roleIds.includes(r))]
        assertCanAssignRoles(d, user, changed)
        const superId = d.roles.find((r) => r.key === 'super_admin')?.id
        if (u.roleIds.includes(superId) && !data.roleIds.includes(superId)) { assertNotLastSuperAdmin(d, u); revokeSessions(d, u.id) }
        u.roleIds = data.roleIds
      }
      if (data.name) u.name = data.name
      auditIn(d, 'user.update', 'user', u.id, diff(before, snapshot(u)))
      return { user: view(d, u) }
    })
  })

  router.post('/api/admin/users/:id/suspend', { perm: 'users.suspend' }, ({ params, body, user, auditIn }) => {
    const { reason } = validate(body, { reason: str({ min: 3, max: 300 }) })
    return store.transaction((d) => {
      const u = target(d, params.id)
      if (u.id === user.id) throw forbidden('You cannot suspend your own account.')
      assertCanManageUser(d, user, u)
      assertNotLastSuperAdmin(d, u)
      if (u.status !== 'active') throw conflict('Only active accounts can be suspended.')
      u.status = 'suspended'
      u.suspendedReason = reason
      revokeSessions(d, u.id)
      auditIn(d, 'user.suspend', 'user', u.id, { status: { from: 'active', to: 'suspended' }, reason: { from: null, to: reason } })
      return { user: view(d, u) }
    })
  })

  router.post('/api/admin/users/:id/reactivate', { perm: 'users.suspend' }, ({ params, user, auditIn }) => store.transaction((d) => {
    const u = target(d, params.id)
    assertCanManageUser(d, user, u)
    if (u.status !== 'suspended') throw conflict('Only suspended accounts can be reactivated.')
    u.status = 'active'
    delete u.suspendedReason
    auditIn(d, 'user.reactivate', 'user', u.id, { status: { from: 'suspended', to: 'active' } })
    return { user: view(d, u) }
  }))

  router.post('/api/admin/users/:id/reset-password', { perm: 'users.update' }, async ({ params, user, auditIn }) => {
    const temp = temporaryPassword()
    const passwordHash = await hashPassword(temp)
    store.transaction((d) => {
      const u = target(d, params.id)
      if (u.id === user.id) throw forbidden('Use "Change password" for your own account.')
      assertCanManageUser(d, user, u)
      if (u.status === 'deleted') throw conflict('This account is deleted.')
      u.passwordHash = passwordHash
      u.mustChangePassword = true
      revokeSessions(d, u.id)
      auditIn(d, 'user.reset_password', 'user', u.id)
    })
    return { temporaryPassword: temp, note: 'Share this one-time password securely. It must be changed at first sign-in and will not be shown again.' }
  })

  router.post('/api/admin/users/:id/revoke-sessions', { perm: 'users.update' }, ({ params, user, auditIn }) => store.transaction((d) => {
    const u = target(d, params.id)
    assertCanManageUser(d, user, u)
    const n = d.sessions.filter((s) => s.userId === u.id).length
    revokeSessions(d, u.id)
    auditIn(d, 'user.revoke_sessions', 'user', u.id, { sessions: { from: n, to: 0 } })
    return { revoked: n }
  }))

  // Soft delete: the account is deactivated and kept for the audit trail. The admin must type the account email.
  router.delete('/api/admin/users/:id', { perm: 'users.delete' }, ({ params, body, user, auditIn }) => {
    const { confirmEmail } = validate(body, { confirmEmail: email() })
    return store.transaction((d) => {
      const u = target(d, params.id)
      if (confirmEmail !== u.email) throw badRequest('Type the account email to confirm.', { confirmEmail: 'Does not match.' })
      if (u.id === user.id) throw forbidden('You cannot delete your own account.')
      assertCanManageUser(d, user, u)
      assertNotLastSuperAdmin(d, u)
      const before = snapshot(u)
      u.status = 'deleted'
      u.deletedAt = new Date().toISOString()
      revokeSessions(d, u.id)
      auditIn(d, 'user.delete', 'user', u.id, diff(before, snapshot(u)))
      return { ok: true }
    })
  })
}
