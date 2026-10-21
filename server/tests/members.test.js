import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp } from './helpers.js'

const sent = []
const t = await startApp({}, { mailer: { send: async (m) => { sent.push(m); return { delivered: false } } } })
after(() => t.close())

const PW = 'Member#Pass123'
const reg = (over = {}) => ({ name: 'Mia Member', email: `m${Math.random().toString(36).slice(2, 8)}@example.test`, phone: '+91 99953 43366', password: PW, confirmPassword: PW, acceptTerms: true, acceptGuidelines: true, acceptPrivacy: true, ...over })
const web = (c) => (m, p, b) => c.req(m, p, b, { 'x-requested-with': 'dscw-web' })
async function member(over) {
  const body = reg(over)
  const c = t.client()
  assert.equal((await c.post('/api/auth/register', body)).status, 201)
  const login = await c.login(body.email, PW, '/api/auth/login')
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return { c, body, id: login.body.user.id }
}

test('registration validates fields and requires each consent', async () => {
  const c = t.client()
  for (const [over, field] of [[{ acceptTerms: false }, 'acceptTerms'], [{ acceptGuidelines: false }, 'acceptGuidelines'], [{ acceptPrivacy: undefined }, 'acceptPrivacy'], [{ phone: '99953 43366' }, 'phone'], [{ password: 'short', confirmPassword: 'short' }, 'password'], [{ confirmPassword: 'Different#Pass1' }, 'confirmPassword'], [{ email: 'nope' }, 'email']]) {
    const r = await c.post('/api/auth/register', reg(over))
    assert.equal(r.status, 400, field)
    assert.ok(r.body.error.details[field], `${field}: ${JSON.stringify(r.body.error.details)}`)
  }
})

test('registration cannot set roles, stores a hash, records policy acceptance with versions', async () => {
  const body = reg({ roleIds: ['x'], roles: ['super_admin'], status: 'admin', isAdmin: true })
  const c = t.client()
  assert.equal((await c.post('/api/auth/register', body)).status, 201)
  const db = t.store.read()
  const u = db.users.find((x) => x.email === body.email.toLowerCase())
  assert.equal(db.roles.find((r) => r.id === u.roleIds[0]).key, 'member')
  assert.equal(u.roleIds.length, 1)
  assert.ok(u.passwordHash.startsWith('scrypt$'))
  assert.ok(!JSON.stringify(u).includes(PW))
  assert.equal(u.phone, '+919995343366')
  const acc = db.policyAcceptances.filter((a) => a.userId === u.id)
  assert.deepEqual(acc.map((a) => a.policyId).sort(), ['guidelines', 'privacy', 'terms'])
  assert.ok(acc.every((a) => a.version === '2026-10-draft-1' && a.acceptedAt))
})

test('a duplicate email gets the identical response (no account enumeration)', async () => {
  const body = reg()
  const c = t.client()
  const first = await c.post('/api/auth/register', body)
  const again = await c.post('/api/auth/register', { ...body, name: 'Someone Else' })
  assert.equal(first.status, again.status)
  assert.deepEqual(first.body, again.body)
  assert.equal(t.store.read().users.filter((u) => u.email === body.email.toLowerCase()).length, 1)
  assert.equal((await c.login(body.email, 'Other#Password1', '/api/auth/login')).status, 401) // existing password still required
})

test('an outdated policy version is rejected', async () => {
  const r = await t.client().post('/api/auth/register', reg({ policyVersions: { terms: 'old', privacy: 'old', guidelines: 'old' } }))
  assert.equal(r.status, 409)
})

test('members cannot use admin APIs or the admin sign-in', async () => {
  const m = await member()
  for (const p of ['/api/admin/users', '/api/admin/dashboard', '/api/admin/moderation/reports', '/api/admin/audit']) assert.equal((await m.c.get(p)).status, 403, p)
  assert.equal((await t.client().login(m.body.email, PW)).status, 401) // admin login refuses accounts with no permissions
})

test('participation needs a signed-in member; anonymous requests are refused', async () => {
  const anon = t.client()
  assert.equal((await anon.get('/api/community/ai/posts')).status, 401)
  assert.equal((await anon.post('/api/community/ai/posts', { content: 'hello there' })).status, 401)
  assert.equal((await anon.post('/api/community/reports', { contentType: 'post', contentId: 'sp-1', reason: 'other' })).status, 401)
})

test('sign-in errors are generic; reset and verification do not reveal accounts', async () => {
  const m = await member()
  const wrong = await t.client().login(m.body.email, 'Wrong#Pass1234', '/api/auth/login')
  const none = await t.client().login('nobody@example.test', 'Wrong#Pass1234', '/api/auth/login')
  assert.equal(wrong.status, 401); assert.equal(none.status, 401)
  assert.equal(wrong.body.error.message, none.body.error.message)
  const a = await t.client().post('/api/auth/forgot-password', { email: m.body.email })
  const b = await t.client().post('/api/auth/forgot-password', { email: 'nobody@example.test' })
  assert.equal(a.status, b.status); assert.deepEqual(a.body, b.body)
})

test('password reset: link works once, old sessions end, new password works', async () => {
  const m = await member()
  sent.length = 0
  await t.client().post('/api/auth/forgot-password', { email: m.body.email })
  const mail = sent.find((x) => x.type === 'reset-password' && x.to === m.body.email.toLowerCase())
  assert.ok(mail)
  const token = new URL(mail.link).searchParams.get('reset')
  assert.equal((await t.client().post('/api/auth/reset-password', { token, password: 'weak' })).status, 400)
  assert.equal((await t.client().post('/api/auth/reset-password', { token, password: 'Fresh#Password99' })).status, 200)
  assert.equal((await t.client().post('/api/auth/reset-password', { token, password: 'Fresh#Password99' })).status, 400) // single use
  assert.equal((await m.c.get('/api/auth/me')).body.user, null) // signed out everywhere
  assert.equal((await t.client().login(m.body.email, 'Fresh#Password99', '/api/auth/login')).status, 200)
})

test('email verification link works once and is stored only as a hash', async () => {
  sent.length = 0
  const m = await member()
  const mail = sent.find((x) => x.type === 'verify-email' && x.to === m.body.email.toLowerCase())
  const token = new URL(mail.link).searchParams.get('verify')
  assert.ok(!JSON.stringify(t.store.read().tokens).includes(token))
  assert.equal((await t.client().post('/api/auth/verify-email', { token })).status, 200)
  assert.equal((await t.client().post('/api/auth/verify-email', { token })).status, 400)
  assert.equal((await m.c.get('/api/auth/me')).body.user.emailVerified, true)
})

test('when verification is enforced, unverified members cannot post', async () => {
  const strict = await startApp({ requireEmailVerification: true })
  const body = reg()
  const c = strict.client()
  await c.post('/api/auth/register', body)
  await c.login(body.email, PW, '/api/auth/login')
  const r = await c.post('/api/community/ai/posts', { content: 'hello world' })
  assert.equal(r.status, 403)
  assert.equal(r.body.error.code, 'verification_required')
  await strict.close()
})

test('new policy versions require re-acceptance before participating', async () => {
  const m = await member()
  assert.equal((await m.c.post('/api/community/ai/posts', { content: 'before change' })).status, 201)
  t.store.transaction((d) => { d.policyAcceptances = d.policyAcceptances.filter((a) => !(a.userId === m.id && a.policyId === 'terms')) }) // simulate a new Terms version
  const blocked = await m.c.post('/api/community/ai/posts', { content: 'after change' })
  assert.equal(blocked.status, 403); assert.equal(blocked.body.error.code, 'policy_required')
  const me = (await m.c.get('/api/auth/me')).body
  assert.deepEqual(me.user.pendingPolicies.map((p) => p.id), ['terms'])
  assert.equal((await m.c.post('/api/auth/accept-policies', { accept: true, versions: me.versions })).status, 200)
  assert.equal((await m.c.post('/api/community/ai/posts', { content: 'after accept' })).status, 201)
})

test('login is rate limited', async () => {
  const lim = await startApp({ loginMaxAttempts: 3 })
  const c = lim.client()
  let last
  for (let i = 0; i < 5; i++) last = await c.login('x@example.test', 'Wrong#Pass1234', '/api/auth/login')
  assert.equal(last.status, 429)
  await lim.close()
})

test('registration and password-reset requests are rate limited', async () => {
  const lim = await startApp({ registerMax: 2, forgotMax: 2 })
  const c = lim.client()
  const statuses = []
  for (let i = 0; i < 4; i++) statuses.push((await c.post('/api/auth/register', reg())).status)
  assert.deepEqual(statuses.slice(2), [429, 429])
  const f = []
  for (let i = 0; i < 4; i++) f.push((await c.post('/api/auth/forgot-password', { email: 'a@example.test' })).status)
  assert.ok(f.includes(429))
  await lim.close()
})
