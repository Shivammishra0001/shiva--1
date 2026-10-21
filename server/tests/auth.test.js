import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, ADMIN } from './helpers.js'

const t = await startApp()
after(() => t.close())

test('unauthenticated requests cannot reach admin APIs', async () => {
  const anon = t.client()
  for (const path of ['/api/admin/users', '/api/admin/dashboard', '/api/admin/audit', '/api/admin/roles', '/api/admin/events']) {
    assert.equal((await anon.get(path)).status, 401, path)
  }
  assert.equal((await anon.post('/api/admin/users', {})).status, 401)
})

test('sign-in errors are generic and wrong passwords are rejected', async () => {
  const a = t.client()
  const wrong = await a.login(ADMIN.email, 'not-the-password')
  const unknown = await a.login('nobody@example.test', 'not-the-password')
  assert.equal(wrong.status, 401)
  assert.equal(unknown.status, 401)
  assert.equal(wrong.body.error.message, unknown.body.error.message)
})

test('repeated failures are rate limited', async () => {
  const limited = await startApp({ loginMaxAttempts: 3 })
  const a = limited.client()
  let last
  for (let i = 0; i < 6; i++) last = await a.login('victim@example.test', 'bad-password-1')
  assert.equal(last.status, 429)
  await limited.close()
})

test('session cookie is HttpOnly and SameSite=Strict', async () => {
  const r = await t.client().login(ADMIN.email, ADMIN.password)
  const cookie = r.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Strict/)
})

test('writes without the CSRF header or from another origin are blocked', async () => {
  const noHeader = await t.admin.req('POST', '/api/admin/roles', { name: 'X', permissions: [] }, { 'x-requested-with': '' })
  assert.equal(noHeader.status, 403)
  const crossOrigin = await t.admin.req('POST', '/api/admin/roles', { name: 'X', permissions: [] }, { origin: 'https://evil.example' })
  assert.equal(crossOrigin.status, 403)
})

test('me never returns password data', async () => {
  const me = await t.admin.get('/api/admin/auth/me')
  assert.equal(me.status, 200)
  assert.ok(!/passwordHash|scrypt\$/.test(JSON.stringify(me.body)))
})

test('logout ends the session', async () => {
  const c = t.client()
  await c.login(ADMIN.email, ADMIN.password)
  assert.equal((await c.get('/api/admin/auth/me')).status, 200)
  await c.post('/api/admin/auth/logout')
  assert.equal((await c.get('/api/admin/auth/me')).status, 401)
})

test('suspended users are signed out and cannot sign in', async () => {
  const u = await t.userWith(['support_analyst'], 'Sam Suspend')
  assert.equal((await u.c.get('/api/admin/enquiries')).status, 200)
  const r = await t.admin.post(`/api/admin/users/${u.id}/suspend`, { reason: 'Policy breach' })
  assert.equal(r.status, 200)
  assert.equal((await u.c.get('/api/admin/enquiries')).status, 401)
  assert.equal((await t.client().login(u.email, 'Str0ngPassword1')).status, 401)
})

test('a temporary password must be changed before anything else works', async () => {
  const roles = (await t.admin.get('/api/admin/roles')).body.items
  const created = await t.admin.post('/api/admin/users', { name: 'Tia Temp', email: 'tia.temp@example.test', roleIds: [roles.find((r) => r.key === 'support_analyst').id] })
  const c = t.client()
  await c.login('tia.temp@example.test', created.body.temporaryPassword)
  assert.equal((await c.get('/api/admin/enquiries')).status, 403)
  assert.equal((await c.get('/api/admin/auth/me')).status, 200)
  const weak = await c.post('/api/admin/auth/change-password', { currentPassword: created.body.temporaryPassword, newPassword: 'short' })
  assert.equal(weak.status, 400)
  const ok = await c.post('/api/admin/auth/change-password', { currentPassword: created.body.temporaryPassword, newPassword: 'AnotherStr0ngPass' })
  assert.equal(ok.status, 200)
  assert.equal((await c.get('/api/admin/enquiries')).status, 200)
})

test('a lock only affects the address that made the wrong guesses, says how long to wait, and a password change lifts it', async () => {
  const lim = await startApp({ loginMaxAttempts: 3, trustProxy: true })
  const attacker = lim.client()
  const from = (c, ip) => (email, password) => c.req('POST', '/api/admin/auth/login', { email, password }, { 'x-forwarded-for': ip })
  const guess = from(attacker, '10.9.9.9')
  let last
  for (let i = 0; i < 4; i++) last = await guess(ADMIN.email, 'not-the-password')
  assert.equal(last.status, 429)
  assert.match(last.body.error.message, /Try again in \d+ (seconds|minutes)/)
  assert.ok(Number(last.headers.get('retry-after')) > 0)
  // The real owner, from another address, is not locked out.
  const owner = lim.client()
  const ok = await from(owner, '10.1.1.1')(ADMIN.email, ADMIN.password)
  assert.equal(ok.status, 200)
  owner.cookie = ok.headers.get('set-cookie').split(';')[0]
  // Changing the password clears the lock for that account everywhere.
  const sameIp = from(lim.client(), '10.2.2.2')
  for (let i = 0; i < 3; i++) await sameIp(ADMIN.email, 'wrong-wrong-1')
  assert.equal((await sameIp(ADMIN.email, ADMIN.password)).status, 429)
  assert.equal((await owner.post('/api/admin/auth/change-password', { currentPassword: ADMIN.password, newPassword: 'Another#Pass12345' })).status, 200)
  assert.equal((await sameIp(ADMIN.email, 'Another#Pass12345')).status, 200)
  await lim.close()
})
