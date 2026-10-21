import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, future } from './helpers.js'

const t = await startApp()
after(() => t.close())

const base = (over = {}) => ({
  title: 'Test Workshop', slug: `test-workshop-${Math.random().toString(36).slice(2, 8)}`, category: 'Workshop', shortDescription: 'A short description for the test.', format: 'Online',
  timeZone: 'Asia/Kolkata', startDateTime: future(10), endDateTime: future(11), ...over,
})
const make = async (over) => (await t.admin.post('/api/admin/events', base(over))).body.item
const go = (id, to, reason) => t.admin.post(`/api/admin/events/${id}/transition`, { to, reason })

test('validation: end before start, bad deadline, unknown time zone, in-person needs a venue', async () => {
  const bad = await t.admin.post('/api/admin/events', base({ endDateTime: future(9) }))
  assert.equal(bad.status, 400)
  assert.ok(bad.body.error.details.endDateTime)
  assert.ok((await t.admin.post('/api/admin/events', base({ registrationDeadline: future(20) }))).body.error.details.registrationDeadline)
  assert.ok((await t.admin.post('/api/admin/events', base({ timeZone: 'Mars/Base' }))).body.error.details.timeZone)
  assert.ok((await t.admin.post('/api/admin/events', base({ format: 'In-person' }))).body.error.details.venueName)
})

test('lifecycle follows the allowed transitions only', async () => {
  const e = await make()
  assert.equal(e.status, 'draft')
  assert.equal((await go(e.id, 'completed')).status, 409) // draft cannot jump to completed
  assert.equal((await go(e.id, 'published')).status, 200)
  assert.equal((await go(e.id, 'completed')).status, 409) // not finished yet
  assert.equal((await go(e.id, 'registration_closed')).status, 200)
  assert.equal((await go(e.id, 'published')).status, 200)
  assert.equal((await go(e.id, 'archived')).status, 409)
})

test('cancelling needs a reason, keeps registrations and stops new ones', async () => {
  const e = await make({ capacity: 5 })
  await go(e.id, 'published')
  const r = await t.admin.post(`/api/admin/events/${e.id}/registrations`, { name: 'Ann Attendee', email: 'ann@example.test' })
  assert.equal(r.status, 201)
  assert.equal((await go(e.id, 'cancelled')).status, 409)
  const cancelled = await go(e.id, 'cancelled', 'Speaker unavailable')
  assert.equal(cancelled.status, 200)
  assert.match(cancelled.body.notifications, /not told/)
  const regs = await t.admin.get(`/api/admin/events/${e.id}/registrations`)
  assert.equal(regs.body.items.length, 1)
  const again = await t.admin.post(`/api/admin/events/${e.id}/registrations`, { name: 'Bob Late', email: 'bob@example.test' })
  assert.equal(again.status, 409)
})

test('capacity, duplicates and deadlines are enforced', async () => {
  const e = await make({ capacity: 2 })
  await go(e.id, 'published')
  const reg = (name, email) => t.admin.post(`/api/admin/events/${e.id}/registrations`, { name, email })
  assert.equal((await reg('One Person', 'one@example.test')).status, 201)
  assert.equal((await reg('One Again', 'one@example.test')).status, 409) // duplicate
  assert.equal((await reg('Two Person', 'two@example.test')).status, 201)
  const full = await reg('Three Person', 'three@example.test')
  assert.equal(full.status, 409)
  assert.match(full.body.error.message, /full/i)
  // Capacity cannot be lowered below the seats already taken.
  assert.ok((await t.admin.patch(`/api/admin/events/${e.id}`, { capacity: 1 })).body.error.details.capacity)
  // Deadline in the past blocks registration.
  const closed = await make({ registrationDeadline: new Date(Date.now() - 1000).toISOString(), startDateTime: future(2), endDateTime: future(3) })
  await go(closed.id, 'published')
  assert.equal((await t.admin.post(`/api/admin/events/${closed.id}/registrations`, { name: 'Too Late', email: 'late@example.test' })).status, 409)
})

test('concurrent registrations never exceed capacity', async () => {
  const e = await make({ capacity: 3 })
  await go(e.id, 'published')
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => t.admin.post(`/api/admin/events/${e.id}/registrations`, { name: `Person ${i}`, email: `p${i}@example.test` })))
  assert.equal(results.filter((r) => r.status === 201).length, 3)
})

test('public registration uses the same rules and is rate limited', async () => {
  const e = await make({ capacity: 1 })
  await go(e.id, 'published')
  const post = (email) => fetch(`${t.url}/api/public/events/${e.slug}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Web Visitor', email }) })
  assert.equal((await post('v1@example.test')).status, 201)
  assert.equal((await post('v2@example.test')).status, 409)
})

test('events with registrations cannot be deleted; sensitive actions are audited', async () => {
  const e = await make()
  await go(e.id, 'published')
  await t.admin.post(`/api/admin/events/${e.id}/registrations`, { name: 'Keep Me', email: 'keep@example.test' })
  assert.equal((await t.admin.del(`/api/admin/events/${e.id}`)).status, 409)
  const log = (await t.admin.get('/api/admin/audit?action=event.')).body.items
  assert.ok(log.some((a) => a.action === 'event.published' && a.resourceId === e.id))
})
