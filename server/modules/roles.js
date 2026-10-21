// Role management with escalation limits: you can only grant or edit what your own permissions cover.
import { randomUUID } from 'node:crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { diff } from '../lib/audit.js'
import { list, str, validate } from '../lib/validate.js'
import { ALL_PERMISSIONS, catalogue } from '../auth/permissions.js'
import { assertCanGrant, SUPER } from '../auth/access.js'

const usage = (db, role) => db.users.filter((u) => u.status !== 'deleted' && u.roleIds.includes(role.id))
const view = (db, r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, system: !!r.system, permissions: r.permissions, userCount: usage(db, r).length, users: usage(db, r).slice(0, 10).map((u) => ({ id: u.id, name: u.name, email: u.email })) })
const find = (db, id) => { const r = db.roles.find((x) => x.id === id); if (!r) throw notFound('Role not found.'); return r }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const schema = { name: str({ min: 2, max: 60 }), description: str({ max: 300, optional: true }), permissions: list(str({ max: 40 }), { max: 100 }) }
const knownPermissions = (perms) => { const bad = perms.filter((p) => !ALL_PERMISSIONS.includes(p)); if (bad.length) throw badRequest('Unknown permission.', { permissions: bad.join(', ') }) }

export function register(router, { store }) {
  router.get('/api/admin/roles', { perm: 'roles.read' }, () => { const db = store.read(); return { items: db.roles.map((r) => view(db, r)), catalogue: catalogue() } })

  router.post('/api/admin/roles', { perm: 'roles.manage' }, ({ body, user, auditIn }) => {
    const data = validate(body, schema)
    knownPermissions(data.permissions)
    return store.transaction((d) => {
      assertCanGrant(d, user, data.permissions)
      const key = slug(data.name)
      if (!key || d.roles.some((r) => r.key === key)) throw conflict('A role with this name already exists.', { name: 'Already in use.' })
      const role = { id: randomUUID(), key, name: data.name, description: data.description ?? '', system: false, permissions: [...new Set(data.permissions)] }
      d.roles.push(role)
      auditIn(d, 'role.create', 'role', role.id, { permissions: { from: [], to: role.permissions } })
      return { status: 201, body: { role: view(d, role) } }
    })
  })

  router.patch('/api/admin/roles/:id', { perm: 'roles.manage' }, ({ params, body, user, auditIn }) => {
    const data = validate(body, schema, { partial: true })
    if (data.permissions) knownPermissions(data.permissions)
    return store.transaction((d) => {
      const role = find(d, params.id)
      if (role.key === SUPER) throw forbidden('The Super Admin role cannot be changed.')
      assertCanGrant(d, user, role.permissions) // you must already hold everything this role grants
      if (data.permissions) assertCanGrant(d, user, data.permissions)
      const before = { name: role.name, description: role.description, permissions: role.permissions }
      if (data.name) role.name = data.name
      if (data.description !== undefined) role.description = data.description
      if (data.permissions) role.permissions = [...new Set(data.permissions)]
      // Anyone holding this role loses access they no longer have a right to.
      if (data.permissions) d.sessions = d.sessions.filter((s) => !usage(d, role).some((u) => u.id === s.userId) || s.userId === user.id)
      auditIn(d, 'role.update', 'role', role.id, diff(before, { name: role.name, description: role.description, permissions: role.permissions }))
      return { role: view(d, role) }
    })
  })

  // Deleting a role that is in use needs a safe reassignment target (`reassignTo`).
  router.delete('/api/admin/roles/:id', { perm: 'roles.manage' }, ({ params, body, user, auditIn }) => {
    const { reassignTo } = validate(body, { reassignTo: str({ max: 64, optional: true }) })
    return store.transaction((d) => {
      const role = find(d, params.id)
      if (role.system) throw conflict('System roles cannot be deleted.')
      assertCanGrant(d, user, role.permissions)
      const users = usage(d, role)
      if (users.length) {
        if (!reassignTo) throw conflict(`${users.length} user(s) still have this role. Choose a role to move them to.`, { users: users.length })
        const next = find(d, reassignTo)
        if (next.id === role.id) throw badRequest('Choose a different role.')
        assertCanGrant(d, user, next.permissions)
        users.forEach((u) => { const real = d.users.find((x) => x.id === u.id); real.roleIds = [...new Set([...real.roleIds.filter((r) => r !== role.id), next.id])] })
      }
      d.roles = d.roles.filter((r) => r.id !== role.id)
      auditIn(d, 'role.delete', 'role', role.id, { name: { from: role.name, to: null }, reassignedUsers: { from: null, to: users.length } })
      return { ok: true, reassigned: users.length }
    })
  })
}
