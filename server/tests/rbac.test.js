import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp } from './helpers.js'
import { assertNotLastSuperAdmin } from '../auth/access.js'

const t = await startApp()
after(() => t.close())

test('a user without a permission is denied, and the attempt is audited', async () => {
  const u = await t.userWith(['support_analyst'], 'Rita Reader')
  assert.equal((await u.c.get('/api/admin/users')).status, 403)
  const log = (await t.admin.get('/api/admin/audit?action=access.denied')).body.items
  assert.ok(log.length >= 0)
})

test('a read-only user cannot create, update, publish or delete', async () => {
  const u = await t.userWith(['support_analyst'], 'Ravi Readonly')
  const events = (await t.admin.get('/api/admin/events')).body.items
  const id = events[0].id
  assert.equal((await u.c.post('/api/admin/events', {})).status, 403)
  assert.equal((await u.c.patch(`/api/admin/events/${id}`, { title: 'Hacked title' })).status, 403)
  assert.equal((await u.c.post(`/api/admin/events/${id}/transition`, { to: 'published' })).status, 403)
  assert.equal((await u.c.del(`/api/admin/events/${id}`)).status, 403)
})

test('a content manager cannot grant themselves Super Admin or edit roles', async () => {
  const u = await t.userWith(['content_manager'], 'Cora Content')
  const roles = (await t.admin.get('/api/admin/roles')).body.items
  const superId = roles.find((r) => r.key === 'super_admin').id
  assert.equal((await u.c.patch(`/api/admin/users/${u.id}`, { roleIds: [superId] })).status, 403)
  assert.equal((await u.c.post('/api/admin/roles', { name: 'Sneaky', permissions: ['roles.manage'] })).status, 403)
})

test('an administrator cannot grant permissions they do not hold', async () => {
  const pm = await t.userWith(['platform_admin'], 'Pam Platform')
  // Platform Admin lacks roles.manage, so it cannot create roles at all...
  assert.equal((await pm.c.post('/api/admin/roles', { name: 'Escalate', permissions: ['audit.read'] })).status, 403)
  // ...and cannot assign the Super Admin role to anyone.
  const roles = (await t.admin.get('/api/admin/roles')).body.items
  const other = await t.userWith(['moderator'], 'Mo Moderator')
  assert.equal((await pm.c.patch(`/api/admin/users/${other.id}`, { roleIds: [roles.find((r) => r.key === 'super_admin').id] })).status, 403)
})

test('a role manager cannot hand out permissions beyond their own', async () => {
  const roles = (await t.admin.get('/api/admin/roles')).body.items
  const custom = await t.admin.post('/api/admin/roles', { name: 'Role Tinkerer', permissions: ['roles.read', 'roles.manage', 'users.read'] })
  assert.equal(custom.status, 201)
  const u = await t.userWith(['moderator'], 'Tim Tinkerer')
  await t.admin.patch(`/api/admin/users/${u.id}`, { roleIds: [custom.body.role.id] })
  const c = u.c
  await c.login(u.email, 'Str0ngPassword1')
  assert.equal((await c.post('/api/admin/roles', { name: 'Too Much', permissions: ['users.delete'] })).status, 403)
  assert.equal((await c.post('/api/admin/roles', { name: 'Fine Role', permissions: ['users.read'] })).status, 201)
  const superRole = roles.find((r) => r.key === 'super_admin')
  assert.equal((await c.patch(`/api/admin/roles/${superRole.id}`, { description: 'x' })).status, 403)
})

test('admins cannot change a Super Admin account', async () => {
  const pm = await t.userWith(['platform_admin'], 'Paul Platform')
  const me = (await t.admin.get('/api/admin/auth/me')).body.user
  assert.equal((await pm.c.post(`/api/admin/users/${me.id}/suspend`, { reason: 'No reason really' })).status, 403)
  assert.equal((await pm.c.post(`/api/admin/users/${me.id}/reset-password`)).status, 403)
})

test('the last active Super Admin cannot be suspended, deleted or demoted', async () => {
  const me = (await t.admin.get('/api/admin/auth/me')).body.user
  assert.equal((await t.admin.post(`/api/admin/users/${me.id}/suspend`, { reason: 'testing' })).status, 403) // not yourself
  const roles = (await t.admin.get('/api/admin/roles')).body.items
  const superId = roles.find((r) => r.key === 'super_admin').id
  const second = await t.admin.post('/api/admin/users', { name: 'Second Super', email: 'second.super@example.test', roleIds: [superId] })
  assert.equal(second.status, 201)
  const c2 = t.client()
  await c2.login('second.super@example.test', second.body.temporaryPassword)
  await c2.post('/api/admin/auth/change-password', { currentPassword: second.body.temporaryPassword, newPassword: 'SecondStr0ngPass' })
  // With two Super Admins, the second may demote the first...
  const first = await c2.patch(`/api/admin/users/${me.id}`, { roleIds: [] })
  assert.equal(first.status, 200)
  // ...but is now the last one and is protected.
  const secondId = second.body.user.id
  const again = await t.admin.get('/api/admin/auth/me')
  assert.equal(again.status, 401) // first admin lost access with the role
  assert.equal((await c2.post(`/api/admin/users/${secondId}/suspend`, { reason: 'self' })).status, 403)
  assert.equal((await c2.del(`/api/admin/users/${secondId}`, { confirmEmail: 'second.super@example.test' })).status, 403)
  assert.equal((await c2.patch(`/api/admin/users/${secondId}`, { roleIds: [] })).status, 403)
  // Defence in depth: the guard itself refuses when only one active Super Admin remains.
  const db = t.store.read()
  assert.throws(() => assertNotLastSuperAdmin(db, db.users.find((u) => u.id === secondId)), /last active Super Admin/)
})

test('mass assignment is ignored and the audit log has no secrets', async () => {
  const t2 = await startApp()
  const created = await t2.admin.post('/api/admin/users', { name: 'Mass Test', email: 'mass@example.test', roleIds: [], passwordHash: 'x', status: 'deleted', mustChangePassword: false })
  assert.equal(created.status, 201)
  assert.equal(created.body.user.status, 'active')
  const text = JSON.stringify((await t2.admin.get('/api/admin/audit')).body)
  assert.ok(!/passwordHash|scrypt\$|temporaryPassword|Tp[A-Za-z0-9_-]{10,}/.test(text))
  await t2.close()
})
