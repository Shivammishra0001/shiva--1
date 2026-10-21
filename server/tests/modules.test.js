import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp } from './helpers.js'

const t = await startApp()
after(() => t.close())

const project = (over = {}) => ({ name: 'Test Project', slug: `test-project-${Math.random().toString(36).slice(2, 8)}`, category: 'AI', summary: 'A project for the tests.', ...over })

test('project status changes persist, with history, and Market Ready needs evidence', async () => {
  const p = (await t.admin.post('/api/admin/projects', project())).body.item
  assert.equal(p.status, 'draft')
  assert.equal((await t.admin.post(`/api/admin/projects/${p.id}/transition`, { to: 'market_ready' })).status, 409) // illegal jump
  await t.admin.post(`/api/admin/projects/${p.id}/transition`, { to: 'under_development' })
  await t.admin.post(`/api/admin/projects/${p.id}/transition`, { to: 'beta' })
  const noEvidence = await t.admin.post(`/api/admin/projects/${p.id}/transition`, { to: 'market_ready' })
  assert.equal(noEvidence.status, 409)
  const ok = await t.admin.post(`/api/admin/projects/${p.id}/transition`, { to: 'market_ready', reason: 'Verified with the owner: live and available to users.' })
  assert.equal(ok.status, 200)
  const saved = (await t.admin.get(`/api/admin/projects/${p.id}`)).body.item
  assert.equal(saved.status, 'market_ready')
  assert.ok(saved.evidence.confirmedBy)
  assert.ok(saved.statusHistory.length >= 3)
})

test('only reviewers with the publish permission can set Market Ready or publish', async () => {
  const p = (await t.admin.post('/api/admin/projects', project())).body.item
  await t.admin.post(`/api/admin/projects/${p.id}/transition`, { to: 'under_development' })
  const mod = await t.userWith(['moderator'], 'Mia Moderator')
  assert.equal((await mod.c.post(`/api/admin/projects/${p.id}/publish`, { published: true })).status, 403)
  const pm = await t.userWith(['project_manager'], 'Pia Projects')
  assert.equal((await pm.c.post(`/api/admin/projects/${p.id}/publish`, { published: true })).status, 200)
  // Archiving unpublishes.
  await pm.c.post(`/api/admin/projects/${p.id}/transition`, { to: 'archived' })
  assert.equal((await t.admin.get(`/api/admin/projects/${p.id}`)).body.item.published, false)
})

test('communities: slug must be unique, publish needs permission, public API shows only published', async () => {
  const body = { name: 'Test Community', slug: 'test-community', about: 'A place for testing things.', topics: ['Testing'] }
  const c = (await t.admin.post('/api/admin/communities', body)).body.item
  assert.equal((await t.admin.post('/api/admin/communities', body)).status, 409)
  const pub = async () => (await (await fetch(`${t.url}/api/public/communities`)).json()).items.some((x) => x.slug === 'test-community')
  assert.equal(await pub(), false)
  const cm = await t.userWith(['community_manager'], 'Cal Community')
  assert.equal((await cm.c.post(`/api/admin/communities/${c.id}/transition`, { to: 'published' })).status, 200)
  assert.equal(await pub(), true)
  const analyst = await t.userWith(['support_analyst'], 'Ann Analyst')
  assert.equal((await analyst.c.patch(`/api/admin/communities/${c.id}`, { name: 'Changed' })).status, 403)
  assert.equal((await t.admin.post(`/api/admin/communities/${c.id}/transition`, { to: 'archived' })).status, 200)
  assert.equal(await pub(), false)
})

test('content: draft is not public until published', async () => {
  const get = () => fetch(`${t.url}/api/public/content/site.seo`)
  assert.equal((await get()).status, 404)
  assert.equal((await t.admin.put('/api/admin/content/site.seo', { title: 'Draft title' })).status, 200)
  assert.equal((await get()).status, 404)
  assert.equal((await t.admin.post('/api/admin/content/site.seo/publish')).status, 200)
  assert.equal((await (await get()).json()).content.title, 'Draft title')
  assert.equal((await t.admin.put('/api/admin/content/nope.key', { title: 'x' })).status, 404)
  assert.equal((await t.admin.put('/api/admin/content/site.seo', { title: '' })).status, 400)
})

test('enquiries: public form, honeypot, workflow, assignment and notes', async () => {
  const send = (b) => fetch(`${t.url}/api/public/enquiries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })
  assert.equal((await send({ type: 'contact', name: 'Bot', email: 'bot@example.test', message: 'spam spam', website: 'http://spam' })).status, 200)
  assert.equal((await send({ type: 'contact', name: 'Real Person', email: 'real@example.test', message: 'Hello, I have a question.' })).status, 201)
  assert.equal((await send({ type: 'contact', name: 'X', email: 'bad', message: '' })).status, 400)
  const list = (await t.admin.get('/api/admin/enquiries')).body.items
  assert.equal(list.length, 1)
  const id = list[0].id
  assert.equal((await t.admin.post(`/api/admin/enquiries/${id}/status`, { status: 'resolved' })).status, 409) // new -> resolved not allowed
  assert.equal((await t.admin.post(`/api/admin/enquiries/${id}/status`, { status: 'in_progress' })).status, 200)
  assert.equal((await t.admin.post(`/api/admin/enquiries/${id}/notes`, { note: 'Called back.' })).status, 200)
  const me = (await t.admin.get('/api/admin/auth/me')).body.user
  assert.equal((await t.admin.post(`/api/admin/enquiries/${id}/assign`, { assigneeId: me.id })).status, 200)
  assert.equal((await t.admin.post(`/api/admin/enquiries/${id}/assign`, { assigneeId: 'nobody' })).status, 400)
})

test('settings need the current password and are audited', async () => {
  assert.equal((await t.admin.patch('/api/admin/settings', { currentPassword: 'wrong', changes: { 'site.maintenance': true } })).status, 400)
  const ok = await t.admin.patch('/api/admin/settings', { currentPassword: 'Sup3rSecretPass', changes: { 'site.maintenance': true, 'uploads.maxMb': 8, 'secret.key': 'x' } })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.values['site.maintenance'], true)
  assert.equal(ok.body.values['secret.key'], undefined)
  assert.equal((await t.admin.patch('/api/admin/settings', { currentPassword: 'Sup3rSecretPass', changes: { 'uploads.maxMb': 999 } })).status, 400)
  const log = (await t.admin.get('/api/admin/audit?action=settings')).body.items
  assert.equal(log[0].action, 'settings.update')
})

test('dashboard shows only sections the user may read, and exports are permission-checked', async () => {
  const analyst = await t.userWith(['support_analyst'], 'Dee Dashboard')
  const d = (await analyst.c.get('/api/admin/dashboard')).body
  assert.equal(d.users, undefined)
  assert.ok(d.events)
  assert.equal((await analyst.c.get('/api/admin/reports/export/users')).status, 403)
  const full = (await t.admin.get('/api/admin/dashboard?days=7')).body
  assert.equal(full.days, 7)
  assert.ok(full.users.total >= 1)
  const csv = await t.admin.get('/api/admin/reports/export/users')
  assert.equal(csv.status, 200)
  assert.match(csv.headers.get('content-type'), /text\/csv/)
  assert.ok(!/passwordHash|scrypt/.test(csv.text))
  assert.ok((await t.admin.get('/api/admin/audit?action=export')).body.items.length >= 1)
})

test('roles: system roles cannot be deleted; in-use roles need a reassignment target', async () => {
  const roles = (await t.admin.get('/api/admin/roles')).body.items
  assert.equal((await t.admin.del(`/api/admin/roles/${roles.find((r) => r.key === 'moderator').id}`)).status, 409)
  const custom = (await t.admin.post('/api/admin/roles', { name: 'Temp Role', permissions: ['users.read'] })).body.role
  const u = await t.userWith(['moderator'], 'Rex Role')
  await t.admin.patch(`/api/admin/users/${u.id}`, { roleIds: [custom.id] })
  assert.equal((await t.admin.del(`/api/admin/roles/${custom.id}`)).status, 409)
  const moved = await t.admin.del(`/api/admin/roles/${custom.id}`, { reassignTo: roles.find((r) => r.key === 'moderator').id })
  assert.equal(moved.status, 200)
  assert.equal(moved.body.reassigned, 1)
})

test('user deletion needs email confirmation and is a soft delete', async () => {
  const u = await t.userWith(['moderator'], 'Dan Delete')
  assert.equal((await t.admin.del(`/api/admin/users/${u.id}`, { confirmEmail: 'wrong@example.test' })).status, 400)
  assert.equal((await t.admin.del(`/api/admin/users/${u.id}`, { confirmEmail: u.email })).status, 200)
  assert.equal((await t.admin.get('/api/admin/users?status=deleted')).body.items.some((x) => x.id === u.id), true)
  assert.equal((await t.client().login(u.email, 'Str0ngPassword1')).status, 401)
})
