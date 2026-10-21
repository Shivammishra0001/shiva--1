import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp } from './helpers.js'
import { screenContent } from '../lib/contentRules.js'

const t = await startApp({ reportThreshold: 2 })
after(() => t.close())

const PW = 'Member#Pass123'
let n = 0
async function member(name = 'Test Member') {
  const email = `mod${++n}.${Math.random().toString(36).slice(2, 6)}@example.test`
  const c = t.client()
  await c.post('/api/auth/register', { name, email, phone: '+919999900000', password: PW, confirmPassword: PW, acceptTerms: true, acceptGuidelines: true, acceptPrivacy: true })
  const r = await c.login(email, PW, '/api/auth/login')
  return { c, email, id: r.body.user.id }
}
const post = async (m, content, slug = 'ai') => (await m.c.post(`/api/community/${slug}/posts`, { content })).body
const report = (m, id, reason = 'harassment_threats', type = 'post') => m.c.post('/api/community/reports', { contentType: type, contentId: id, reason })

test('screening holds scams and threats but does not flag technical or security discussion', () => {
  assert.equal(screenContent('Here is how SQL injection works and how to prevent it in your API.').verdict, 'published')
  assert.equal(screenContent('We will kill the process and restart the server; the attack surface is small.').verdict, 'published')
  assert.equal(screenContent('Responsible disclosure: I found an XSS bug and reported it to the vendor.').verdict, 'published')
  assert.equal(screenContent('The news reported that someone threatened violence at the event.').verdict, 'published')
  assert.equal(screenContent('Guaranteed returns! Double your crypto today https://bit.ly/abc').verdict, 'pending_review')
  assert.equal(screenContent('Please verify your account password here https://example.test/login').verdict, 'pending_review')
  assert.equal(screenContent("I'm going to kill you").verdict, 'restricted')
})

test('flagged posts are held before publishing and are visible only to their author', async () => {
  const a = await member('Alice Author'); const b = await member('Bob Reader')
  const ok = await post(a, 'A normal post about embeddings.')
  assert.equal(ok.held, false)
  const held = await post(a, 'Double your crypto, guaranteed returns https://bit.ly/x')
  assert.equal(held.held, true)
  assert.match(held.message, /awaiting review/)
  const feedB = (await b.c.get('/api/community/ai/posts')).body.items.map((p) => p.id)
  assert.ok(feedB.includes(ok.post.id)); assert.ok(!feedB.includes(held.post.id))
  const feedA = (await a.c.get('/api/community/ai/posts')).body.items.find((p) => p.id === held.post.id)
  assert.equal(feedA.status, 'pending_review')
  const staff = await t.userWith(['moderator'], 'Mo Queue')
  const q = (await staff.c.get('/api/admin/moderation/reports')).body.items
  assert.ok(q.some((r) => r.contentId === held.post.id && r.source === 'system'))
})

test('severe content is restricted for urgent review but the author is not suspended automatically', async () => {
  const a = await member('Sam Severe')
  const p = await post(a, "I'm going to kill you tomorrow")
  assert.equal(p.post.status, 'restricted')
  const u = t.store.read().users.find((x) => x.id === a.id)
  assert.equal(u.status, 'active'); assert.ok(!u.suspendedUntil)
  assert.equal((await post(a, 'Back to normal conversation')).held, false)
})

test('reports are recorded with a reference, deduplicated, and reporter identity is hidden from moderators', async () => {
  const a = await member('Rep Target'); const r1 = await member('Reporter One'); const r2 = await member('Reporter Two')
  const p = (await post(a, 'Something questionable')).post
  assert.equal((await report(a, p.id)).status, 409) // own content
  const first = await report(r1, p.id)
  assert.equal(first.status, 201); assert.match(first.body.ref, /^RPT-/)
  const dup = await report(r1, p.id)
  assert.equal(dup.body.ref, first.body.ref)
  assert.equal((await r1.c.post('/api/community/reports', { contentType: 'post', contentId: p.id, reason: 'nonsense' })).status, 400)
  // A second distinct reporter reaches the threshold (2): held for review, not removed.
  await report(r2, p.id)
  assert.equal(t.store.read().posts.find((x) => x.id === p.id).status, 'pending_review')
  const staff = await t.userWith(['moderator'], 'Mo Mask')
  const list = (await staff.c.get('/api/admin/moderation/reports')).body.items.filter((r) => r.contentId === p.id)
  assert.ok(list.length >= 2)
  assert.ok(list.every((r) => r.reporter === null))
  assert.ok(!JSON.stringify((await staff.c.get(`/api/admin/moderation/reports/${list[0].id}`)).body).includes(r1.id))
  // Members cannot read reports at all.
  assert.equal((await r1.c.get('/api/admin/moderation/reports')).status, 403)
})

test('moderation decisions persist, notify the author, and are audited', async () => {
  const a = await member('Dee Decided'); const r = await member('Rita Reporter')
  const p = (await post(a, 'Borderline content here')).post
  const rep = (await report(r, p.id, 'hate_abuse')).body
  const staff = await t.userWith(['moderator'], 'Mo Decide')
  const id = (await staff.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id
  assert.equal((await staff.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'remove', reason: 'x' })).status, 400) // reason too short
  const done = await staff.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'remove', reason: 'Targeted abuse against another member.' })
  assert.equal(done.status, 200)
  assert.equal(t.store.read().posts.find((x) => x.id === p.id).status, 'removed')
  assert.equal((await staff.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'dismiss', reason: 'again please' })).status, 409) // already decided
  const me = (await a.c.get('/api/auth/me')).body.user
  assert.ok(me.notices.some((x) => /removed/i.test(x.message) && x.appealable))
  const log = (await t.admin.get('/api/admin/audit?action=moderation.')).body.items
  assert.ok(log.some((x) => x.action === 'moderation.remove' && x.actorEmail))
  const feed = (await r.c.get('/api/community/ai/posts')).body.items.map((x) => x.id)
  assert.ok(!feed.includes(p.id))
})

test('false positives can be dismissed (content returns) and wrongful removals can be appealed and reversed by a different reviewer', async () => {
  const a = await member('Fay False'); const r = await member('Ray Reporter')
  const p1 = (await post(a, 'Guaranteed returns on this API design pattern https://bit.ly/doc')).post
  const s1 = await t.userWith(['moderator'], 'Mo One'); const s2 = await t.userWith(['moderator'], 'Mo Two')
  const q = (await s1.c.get('/api/admin/moderation/reports?source=system')).body.items.find((x) => x.contentId === p1.id)
  await s1.c.post(`/api/admin/moderation/reports/${q.id}/decide`, { decision: 'dismiss', reason: 'Legitimate technical post, false positive.' })
  assert.equal(t.store.read().posts.find((x) => x.id === p1.id).status, 'published')

  const p2 = (await post(a, 'An opinion that someone disliked')).post
  const rep = (await report(r, p2.id, 'other')).body
  const id = (await s1.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id
  const dec = (await s1.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'remove', reason: 'Removed in error for the test.' })).body
  const actionId = dec.actionId
  assert.equal((await r.c.post('/api/community/appeals', { actionId, message: 'This was not my content.' })).status, 404) // only the author can appeal
  assert.equal((await a.c.post('/api/community/appeals', { actionId, message: 'short' })).status, 400)
  const ap = await a.c.post('/api/community/appeals', { actionId, message: 'I believe this was a legitimate opinion.' })
  assert.equal(ap.status, 201)
  assert.equal(t.store.read().posts.find((x) => x.id === p2.id).status, 'under_appeal')
  assert.equal((await a.c.post('/api/community/appeals', { actionId, message: 'Trying a second time now.' })).status, 409)
  const appealId = (await s1.c.get('/api/admin/moderation/appeals')).body.items[0].id
  assert.equal((await s1.c.post(`/api/admin/moderation/appeals/${appealId}/decide`, { outcome: 'reverse', note: 'Reviewing my own decision.' })).status, 403) // same moderator
  assert.equal((await s2.c.post(`/api/admin/moderation/appeals/${appealId}/decide`, { outcome: 'reverse', note: 'Opinion is within the guidelines.' })).status, 200)
  assert.equal(t.store.read().posts.find((x) => x.id === p2.id).status, 'published')
  assert.equal(t.store.read().actions.find((x) => x.id === actionId).appealStatus, 'reversed')
})

test('restrictions and suspensions block posting or sign-in, are reversible, and appeals work for suspended members', async () => {
  const a = await member('Rex Restricted'); const r = await member('Rob Reporter')
  const staff = await t.userWith(['moderator'], 'Mo Enforce')
  const decide = async (m, rid, body) => (await staff.c.post(`/api/admin/moderation/reports/${rid}/decide`, body))
  const pid = async (content, reason) => { const p = (await post(a, content)).post; const rep = (await report(r, p.id, reason)).body; return (await staff.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id }
  assert.equal((await decide(a, await pid('First problem post', 'harassment_threats'), { decision: 'restrict_user', reason: 'Repeated abuse of members.' })).status, 400) // days required
  assert.equal((await decide(a, await pid('Second problem post', 'harassment_threats'), { decision: 'restrict_user', reason: 'Repeated abuse of members.', days: 3 })).status, 200)
  const blocked = await a.c.post('/api/community/ai/posts', { content: 'trying to post' })
  assert.equal(blocked.status, 403); assert.equal(blocked.body.error.code, 'restricted')
  assert.equal((await a.c.get('/api/community/ai/posts')).status, 200) // can still read
  const u = (await staff.c.get(`/api/admin/moderation/users/${a.id}`)).body
  assert.ok(u.user.postingRestrictedUntil); assert.equal(u.history[0].type, 'restrict_user')
  assert.equal((await staff.c.post(`/api/admin/moderation/users/${a.id}/lift`, { reason: 'Restriction served early.' })).status, 200)
  assert.equal((await post(a, 'Posting again after lift')).held, false)

  // Temporary suspension: signed out, cannot sign in, can appeal with credentials.
  assert.equal((await decide(a, await pid('Third problem post', 'harassment_threats'), { decision: 'suspend_user', reason: 'Escalating abuse after restriction.', days: 2 })).status, 200)
  assert.equal((await a.c.get('/api/auth/me')).body.user, null)
  const login = await t.client().login(a.email, PW, '/api/auth/login')
  assert.equal(login.status, 403); assert.equal(login.body.error.code, 'suspended')
  assert.equal((await t.client().login(a.email, 'Wrong#Pass1234', '/api/auth/login')).status, 401) // status only revealed after the right password
  const apl = await t.client().post('/api/auth/appeal', { email: a.email, password: PW, message: 'I would like this suspension reviewed.' })
  assert.equal(apl.status, 201)
})

test('permanent suspension needs permission and prior violations; a single report never suffices', async () => {
  const a = await member('Pete Permanent'); const r = await member('Pam Reporter')
  const mod = await t.userWith(['moderator'], 'Mo Perm')
  const pm = await t.userWith(['platform_admin'], 'Pat Platform')
  const p = (await post(a, 'one bad post')).post
  const rep = (await report(r, p.id, 'harassment_threats')).body
  const id = (await mod.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id
  assert.equal((await mod.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'suspend_user', permanent: true, reason: 'Permanent for the test.' })).status, 403) // moderator lacks users.suspend
  const refused = await pm.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'suspend_user', permanent: true, reason: 'Permanent for the test.' })
  assert.equal(refused.status, 409) // no prior violations and not critical
  assert.equal(t.store.read().users.find((u) => u.id === a.id).status, 'active')
})

test('escalation preserves restricted evidence; only evidence holders can view it; disclosures are recorded, nothing is auto-sent', async () => {
  const a = await member('Eve Escalate'); const r = await member('Ron Reporter')
  const p = (await post(a, 'a post that someone reported as dangerous')).post
  const rep = (await report(r, p.id, 'sexual_exploitation')).body
  const mod = await t.userWith(['moderator'], 'Mo Escalate')
  const id = (await mod.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id
  assert.equal((await mod.c.post(`/api/admin/moderation/reports/${id}/decide`, { decision: 'escalate', reason: 'Needs authorised review.' })).status, 200)
  assert.equal((await mod.c.get(`/api/admin/moderation/cases/${rep.ref}`)).status, 403)
  assert.equal((await mod.c.get('/api/admin/moderation/cases')).status, 403)
  const pm = await t.userWith(['platform_admin'], 'Pat NoEvidence')
  assert.equal((await pm.c.get(`/api/admin/moderation/cases/${rep.ref}`)).status, 403) // platform admin lacks evidence access by default
  const ev = await t.admin.get(`/api/admin/moderation/cases/${rep.ref}`)
  assert.equal(ev.status, 200); assert.ok(ev.body.snapshot.content.includes('dangerous')); assert.equal(ev.body.accessLog.length, 1)
  const disc = await t.admin.post(`/api/admin/moderation/cases/${rep.ref}/disclosures`, { recipient: 'Cyber Crime Cell (valid legal request ref 123)', basis: 'legal_request', summary: 'Shared the preserved post and account name in response to a court order.' })
  assert.equal(disc.status, 201)
  assert.ok((await t.admin.get('/api/admin/audit?action=disclosure')).body.items.length >= 1)
  assert.equal(t.store.read().users.find((u) => u.id === a.id).status, 'active') // no automatic action against the person
})

test('moderators cannot sanction staff more powerful than themselves, nor decide on their own content', async () => {
  const mod = await t.userWith(['moderator'], 'Mo Limits')
  const boss = await t.userWith(['platform_admin'], 'Pat Boss')
  // Staff accounts are accounts too: this one accepts the policies and posts like a member.
  const c = boss.c
  const v = (await c.get('/api/auth/me')).body
  await c.post('/api/auth/accept-policies', { accept: true, versions: v.versions })
  const pid = (await c.post('/api/community/ai/posts', { content: 'staff member post' })).body.post.id
  const reporter = await member('Reporter Limit')
  const rep = (await report(reporter, pid, 'harassment_threats')).body
  const rid = (await mod.c.get('/api/admin/moderation/reports')).body.items.find((x) => x.ref === rep.ref).id
  assert.equal((await mod.c.post(`/api/admin/moderation/reports/${rid}/decide`, { decision: 'restrict_user', days: 2, reason: 'Trying to sanction an admin.' })).status, 403)
})

test('retention anonymises old resolved reports', async () => {
  const { applyRetention } = await import('../lib/retention.js')
  t.store.transaction((d) => { d.reports.push({ id: 'old1', ref: 'RPT-OLD001', contentType: 'post', contentId: 'x', reason: 'other', details: 'private text', reporterId: 'someone', status: 'resolved', createdAt: '2020-01-01T00:00:00Z', resolvedAt: '2020-01-02T00:00:00Z' }) })
  assert.ok(applyRetention(t.store, { reportRetentionDays: 365 }) >= 1)
  const r = t.store.read().reports.find((x) => x.id === 'old1')
  assert.equal(r.reporterId, null); assert.equal(r.details, '')
})
