import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, future } from './helpers.js'

const t = await startApp()
after(() => t.close())

const PW = 'Member#Pass123'
let n = 0
async function member(name = 'Test Member') {
  const email = `pf${++n}.${Math.random().toString(36).slice(2, 6)}@example.test`
  const c = t.client()
  await c.post('/api/auth/register', { name, email, phone: '+919999900000', password: PW, confirmPassword: PW, acceptTerms: true, acceptGuidelines: true, acceptPrivacy: true })
  const r = await c.login(email, PW, '/api/auth/login')
  return { c, email, id: r.body.user.id }
}
// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

test('a member edits only the permitted fields of their own profile; privileged fields are ignored', async () => {
  const m = await member('Pro File')
  const r = await m.c.patch('/api/me/profile', { name: 'Pro Filer', username: 'Pro_Filer', headline: 'ML engineer', bio: 'I build search systems.', location: 'Delhi', interests: ['RAG', 'Evals'], skills: ['Python'], links: [{ label: 'Site', url: 'https://example.com' }], roleIds: ['x'], status: 'suspended', emailVerified: true, email: 'evil@example.test', phone: '+1000' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  const u = r.body.user
  assert.equal(u.username, 'pro_filer'); assert.equal(u.headline, 'ML engineer'); assert.deepEqual(u.interests, ['RAG', 'Evals'])
  const row = t.store.read().users.find((x) => x.id === m.id)
  assert.equal(row.status, 'active'); assert.equal(row.emailVerified, false); assert.equal(row.email, m.email); assert.equal(row.phone, '+919999900000')
  assert.equal(row.roleIds.length, 1)
  // clearing a field works
  assert.equal((await m.c.patch('/api/me/profile', { headline: '' })).body.user.headline, '')
})

test('validation: username rules and uniqueness, https-only links, unsafe text', async () => {
  const a = await member('Una Name'); const b = await member('Una Other')
  assert.equal((await a.c.patch('/api/me/profile', { username: 'unique_one' })).status, 200)
  const dup = await b.c.patch('/api/me/profile', { username: 'UNIQUE_ONE' })
  assert.equal(dup.status, 409)
  for (const bad of ['ab', 'has space', 'admin', 'x'.repeat(31)]) assert.equal((await b.c.patch('/api/me/profile', { username: bad })).status, 400, bad)
  assert.ok((await b.c.patch('/api/me/profile', { links: [{ label: 'x', url: 'http://insecure.example' }] })).body.error.details.links)
  assert.ok((await b.c.patch('/api/me/profile', { links: [{ label: 'x', url: 'javascript:alert(1)' }] })).body.error.details.links)
  assert.equal((await b.c.patch('/api/me/profile', { headline: 'Double your crypto guaranteed returns https://bit.ly/x' })).status, 400)
  assert.equal((await b.c.patch('/api/me/profile', { interests: Array(13).fill('x') })).status, 400)
})

test('a flagged bio is saved but hidden from others until reviewed', async () => {
  const a = await member('Bio Person'); const b = await member('Bio Viewer')
  const r = await a.c.patch('/api/me/profile', { bio: "I'm going to kill you all" })
  assert.equal(r.body.held, true)
  const v = (await b.c.get(`/api/members/${a.id}`)).body.profile
  assert.equal(v.bio, undefined)
})

test('privacy is enforced on the server: default members-only, private and public modes, no email or phone leaks', async () => {
  const a = await member('Priv Owner'); const viewer = await member('Priv Viewer'); const anon = t.client()
  await a.c.patch('/api/me/profile', { headline: 'Data lead', interests: ['Graphs'], location: 'Pune' })
  let p = (await viewer.c.get(`/api/members/${a.id}`)).body.profile
  assert.equal(p.headline, 'Data lead'); assert.equal(p.interests, undefined); assert.equal(p.location, undefined); assert.equal(p.email, undefined); assert.equal(p.communities, undefined)
  assert.ok(!JSON.stringify(p).includes('999990')) // no phone
  assert.equal((await anon.get(`/api/members/${a.id}`)).status, 404) // members-only by default
  await a.c.patch('/api/me/settings', { showInterests: true, showLocation: true, showEmail: true, showCommunities: true })
  p = (await viewer.c.get(`/api/members/${a.id}`)).body.profile
  assert.deepEqual(p.interests, ['Graphs']); assert.equal(p.location, 'Pune'); assert.equal(p.email, a.email)
  assert.equal((await anon.get(`/api/members/${a.id}`)).status, 404) // email still only for signed-in members
  await a.c.patch('/api/me/settings', { visibility: 'private' })
  assert.equal((await viewer.c.get(`/api/members/${a.id}`)).status, 404)
  assert.equal((await a.c.get(`/api/members/${a.id}`)).status, 200) // the owner always can
  await a.c.patch('/api/me/settings', { visibility: 'public' })
  const pub = await anon.get(`/api/members/${a.id}`)
  assert.equal(pub.status, 200); assert.equal(pub.body.profile.email, undefined) // anonymous visitors never get the email
  assert.equal((await a.c.patch('/api/me/settings', { visibility: 'everyone' })).status, 400)
})

test('there is no way to edit or read another member\'s private data through the profile APIs', async () => {
  const a = await member('Idor A'); const b = await member('Idor B')
  // /api/me/* never takes a user id; sending one is ignored
  await b.c.patch('/api/me/profile', { id: a.id, userId: a.id, name: 'Hijacked Name' })
  assert.equal(t.store.read().users.find((u) => u.id === a.id).name, 'Idor A')
  assert.equal((await b.c.put(`/api/members/${a.id}/avatar`, { image: PNG })).status, 405)
  assert.equal((await b.c.patch(`/api/members/${a.id}`, { name: 'x' })).status, 405)
  assert.equal((await t.client().get('/api/me/profile')).status, 401)
  assert.equal((await t.client().get('/api/me/activity')).status, 401)
  assert.equal((await t.client().get('/api/me/participation')).status, 401)
})

test('avatars: valid images upload and display; wrong types, fake files and oversize files are refused; visibility applies', async () => {
  const a = await member('Ava Tar'); const v = await member('Ava Viewer'); const anon = t.client()
  const up = await a.c.put('/api/me/avatar', { image: PNG })
  assert.equal(up.status, 200); assert.match(up.body.avatarUrl, /^\/api\/members\/.+\/avatar\?v=/)
  const img = await a.c.get(up.body.avatarUrl)
  assert.equal(img.status, 200); assert.match(img.headers.get('content-type'), /image\/png/); assert.equal(img.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await v.c.get(up.body.avatarUrl)).status, 200) // members-only: another member can
  assert.equal((await anon.get(up.body.avatarUrl)).status, 404) // an anonymous visitor cannot
  const html = Buffer.from('<script>alert(1)</script>').toString('base64')
  assert.equal((await a.c.put('/api/me/avatar', { image: `data:image/png;base64,${html}` })).status, 400) // lies about its type
  assert.equal((await a.c.put('/api/me/avatar', { image: `data:image/svg+xml;base64,${html}` })).status, 400)
  assert.equal((await a.c.put('/api/me/avatar', { image: 'not an image' })).status, 400)
  const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.alloc(420 * 1024)]).toString('base64')
  assert.equal((await a.c.put('/api/me/avatar', { image: `data:image/png;base64,${big}` })).status, 400)
  assert.equal((await a.c.del('/api/me/avatar')).status, 200)
  assert.equal((await a.c.get(up.body.avatarUrl)).status, 404)
})

test('joined communities come from real membership records; joins are unique and reversible; cohorts are separate', async () => {
  const m = await member('Join Er')
  assert.deepEqual((await m.c.get('/api/me/participation')).body.communities, [])
  assert.equal((await m.c.post('/api/community/ai/membership')).status, 200)
  assert.equal((await m.c.post('/api/community/ai/membership')).status, 200) // idempotent, no duplicate
  assert.equal(t.store.read().memberships.filter((x) => x.userId === m.id).length, 1)
  assert.equal((await m.c.post('/api/community/openai/membership')).status, 404) // a cohort is not a community
  assert.equal((await m.c.post('/api/community/nope/membership')).status, 404)
  let part = (await m.c.get('/api/me/participation')).body
  assert.deepEqual(part.communities.map((c) => c.slug), ['ai']); assert.equal(part.cohorts.length, 0)
  assert.equal((await m.c.post('/api/cohorts/openai/enrollment')).status, 200)
  assert.equal((await m.c.post('/api/cohorts/openai/enrollment')).status, 200)
  assert.equal((await m.c.post('/api/cohorts/ai/enrollment')).status, 404) // a community is not a cohort
  part = (await m.c.get('/api/me/participation')).body
  assert.deepEqual(part.cohorts.map((c) => [c.slug, c.status]), [['openai', 'enrolled']]); assert.deepEqual(part.communities.map((c) => c.slug), ['ai'])
  await m.c.del('/api/community/ai/membership')
  await m.c.del('/api/cohorts/openai/enrollment')
  part = (await m.c.get('/api/me/participation')).body
  assert.equal(part.communities.length, 0); assert.deepEqual(part.cohorts.map((c) => c.status), ['withdrawn'])
  await m.c.post('/api/community/ai/membership')
  assert.equal(t.store.read().memberships.filter((x) => x.userId === m.id).length, 1) // re-joining reuses the record
})

test('event registrations belong to the account, stay distinct from memberships, follow the rules, and can be cancelled before the start', async () => {
  const m = await member('Reg Ister'); const other = await member('Reg Other')
  const mk = async (over) => (await t.admin.post('/api/admin/events', { title: 'Profile Event', slug: `pe-${Math.random().toString(36).slice(2, 7)}`, category: 'Workshop', shortDescription: 'An event for profile tests.', format: 'Online', timeZone: 'Asia/Kolkata', startDateTime: future(5), endDateTime: future(6), capacity: 1, ...over })).body.item
  const ev = await mk()
  await t.admin.post(`/api/admin/events/${ev.id}/transition`, { to: 'published' })
  assert.equal((await m.c.post(`/api/community/events/${ev.slug}/register`, { name: 'Forged Name', email: 'forged@example.test' })).status, 201)
  const reg = t.store.read().registrations.find((r) => r.eventId === ev.id)
  assert.equal(reg.userId, m.id); assert.equal(reg.email, m.email); assert.equal(reg.name, 'Reg Ister') // identity from the account
  assert.equal((await m.c.post(`/api/community/events/${ev.slug}/register`)).status, 409) // duplicate
  assert.equal((await other.c.post(`/api/community/events/${ev.slug}/register`)).status, 409) // full
  assert.equal((await m.c.get('/api/me/participation')).body.communities.length, 0) // registering did not join a community
  const mine = (await m.c.get('/api/me/participation')).body.events
  assert.equal(mine.length, 1); assert.equal(mine[0].status, 'registered'); assert.equal(mine[0].title, 'Profile Event')
  assert.equal((await other.c.del(`/api/community/events/${ev.slug}/register`)).status, 404) // not theirs to cancel
  assert.equal((await m.c.del(`/api/community/events/${ev.slug}/register`)).status, 200)
  assert.equal((await m.c.get('/api/me/participation')).body.events[0].status, 'cancelled')
  assert.equal((await other.c.post(`/api/community/events/${ev.slug}/register`)).status, 201) // seat freed
  assert.equal((await m.c.post(`/api/community/events/${ev.slug}/register`)).status, 409) // full again
  // an event that has started cannot be cancelled
  const started = await mk({ startDateTime: new Date(Date.now() - 3600_000).toISOString(), endDateTime: future(1), capacity: undefined })
  await t.admin.post(`/api/admin/events/${started.id}/transition`, { to: 'published' }).catch(() => {})
  t.store.transaction((d) => { const e = d.events.find((x) => x.id === started.id); e.status = 'published'; d.registrations.push({ id: 'rs1', eventId: e.id, userId: other.id, name: 'x', email: other.email, status: 'registered', createdAt: new Date().toISOString() }) })
  assert.equal((await other.c.del(`/api/community/events/${started.slug}/register`)).status, 409)
  // re-registering after cancelling reuses the record
  const again = await mk({ capacity: 5 }); await t.admin.post(`/api/admin/events/${again.id}/transition`, { to: 'published' })
  await m.c.post(`/api/community/events/${again.slug}/register`); await m.c.del(`/api/community/events/${again.slug}/register`); await m.c.post(`/api/community/events/${again.slug}/register`)
  assert.equal(t.store.read().registrations.filter((r) => r.eventId === again.id && r.userId === m.id).length, 1)
})

test('activity is real, newest first, paginated, private to its owner, and never includes admin audit records', async () => {
  const m = await member('Act Ivity'); const o = await member('Act Other')
  await m.c.post('/api/community/ai/membership')
  await m.c.post('/api/cohorts/openai/enrollment')
  await m.c.patch('/api/me/profile', { headline: 'Builder' })
  const p = (await m.c.post('/api/community/ai/posts', { content: 'My first post here' })).body.post
  await m.c.post(`/api/community/posts/${p.id}/comments`, { content: 'And a comment' })
  const feed = (await m.c.get('/api/me/activity')).body
  assert.deepEqual(feed.items.map((a) => a.type), ['comment_created', 'post_created', 'profile_updated', 'cohort_enrolled', 'community_joined'])
  assert.equal(feed.items.find((a) => a.type === 'community_joined').resource.link, '/community.html?c=ai')
  assert.ok(!JSON.stringify(feed).includes('auditLogs') && !feed.items.some((a) => 'userId' in a || 'ip' in a))
  const page1 = (await m.c.get('/api/me/activity?pageSize=2')).body
  assert.equal(page1.items.length, 2); assert.equal(page1.pages, 3)
  assert.equal((await o.c.get('/api/me/activity')).body.items.length, 0) // somebody else sees none of it
  // a moderation notice shows up for the affected person only
  const mod = await t.userWith(['moderator'], 'Mo Activity')
  const rep = (await o.c.post('/api/community/reports', { contentType: 'post', contentId: p.id, reason: 'other' })).body
  const id = (await mod.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id
  await mod.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'warn', reason: 'A friendly reminder only.' })
  assert.ok((await m.c.get('/api/me/activity')).body.items.some((a) => a.type === 'moderation_notice'))
  assert.ok(!(await o.c.get('/api/me/activity')).body.items.some((a) => a.type === 'moderation_notice'))
})

test('admins see participation only with the right permissions and never secrets; list filters work', async () => {
  const m = await member('Admin View'); await m.c.post('/api/community/ai/membership'); await m.c.post('/api/cohorts/openai/enrollment')
  const r = (await t.admin.get(`/api/admin/users/${m.id}/participation`)).body
  assert.deepEqual(r.communities.map((c) => c.slug), ['ai']); assert.deepEqual(r.cohorts.map((c) => c.slug), ['openai'])
  assert.ok(!/passwordHash|scrypt|token/i.test(JSON.stringify(r)))
  assert.equal(r.moderation.length, 0)
  const joined = (await t.admin.get('/api/admin/users?community=ai')).body.items.map((u) => u.id)
  assert.ok(joined.includes(m.id))
  assert.ok(!(await t.admin.get('/api/admin/users?community=quantum')).body.items.some((u) => u.id === m.id))
  assert.ok((await t.admin.get('/api/admin/users?cohort=openai')).body.items.some((u) => u.id === m.id))
  const support = await t.userWith(['support_analyst'], 'Sue Support')
  assert.equal((await support.c.get(`/api/admin/users/${m.id}/participation`)).status, 403)
  const mod = await t.userWith(['moderator'], 'Mo Limited') // has users.read but not users.update
  const view = (await mod.c.get(`/api/admin/users/${m.id}/participation`)).body
  assert.match(view.profile.phone, /•/); assert.notEqual(view.profile.phone, '+919999900000')
  assert.ok(view.moderation) // moderators do get moderation history
  assert.equal((await m.c.get(`/api/admin/users/${m.id}/participation`)).status, 403) // members cannot
})

test('password change from the profile works and ends other sessions; deactivation request is recorded once', async () => {
  const m = await member('Pass Word')
  const other = t.client(); await other.login(m.email, PW, '/api/auth/login')
  assert.equal((await m.c.post('/api/auth/change-password', { currentPassword: 'Wrong#Pass1234', newPassword: 'NewMember#Pass1' })).status, 400)
  assert.equal((await m.c.post('/api/auth/change-password', { currentPassword: PW, newPassword: 'weak' })).status, 400)
  assert.equal((await m.c.post('/api/auth/change-password', { currentPassword: PW, newPassword: 'NewMember#Pass1' })).status, 200)
  assert.equal((await other.get('/api/auth/me')).body.user, null)
  assert.equal((await t.client().login(m.email, 'NewMember#Pass1', '/api/auth/login')).status, 200)
  const a = await m.c.post('/api/me/deactivation-request', { reason: 'Leaving the platform.' }); const b = await m.c.post('/api/me/deactivation-request', {})
  assert.equal(a.status, 201); assert.equal(b.status, 200)
  assert.equal((await t.admin.get('/api/admin/enquiries?type=deactivation')).body.items.length >= 1, true)
  assert.equal(t.store.read().users.find((u) => u.id === m.id).status, 'active') // not deactivated automatically
})
