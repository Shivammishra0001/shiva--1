// The signed-in member's own profile, memberships, enrolments, event registrations and activity, plus the privacy-checked
// public view of other members. Everything under /api/me acts on the caller only: there is no user id in those routes,
// so one member cannot reach another member's private data. Staff view participation through the admin API instead.
import { createHash, randomUUID } from 'node:crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { bool, list, obj, oneOf, str, validate } from '../lib/validate.js'
import { cleanText, safeLink, screenContent } from '../lib/contentRules.js'
import { diff } from '../lib/audit.js'
import { hashPassword, passwordProblem, verifyPassword } from '../lib/crypto.js'
import { paginate } from '../lib/list.js'
import { logActivity } from '../lib/activity.js'
import { registerFor } from '../lib/eventRules.js'
import { AVATAR_MAX_BYTES, sniffImage } from '../lib/storage.js'
import { avatarUrl, memberView, settingsOf } from '../lib/members.js'
import { newRef } from './community.js'

const RESERVED = ['admin', 'administrator', 'root', 'support', 'moderator', 'staff', 'system', 'official', 'help', 'api']
const USERNAME = /^[a-z0-9_]{3,30}$/

const space = (db, kind, slug) => (kind === 'community' ? db.communities : db.cohorts).find((c) => c.slug === slug)
const published = (db, kind, slug) => { const c = space(db, kind, slug); return c && c.status === 'published' ? c : null }
const nameOf = (c, fallback) => c?.name ?? fallback

// Everything this person is part of, as separate relationships (membership, enrolment and registration are different things).
export function participationOf(db, userId) {
  const communities = db.memberships.filter((m) => m.userId === userId && m.status === 'active').map((m) => {
    const c = space(db, 'community', m.slug)
    return { slug: m.slug, name: nameOf(c, m.slug), status: 'member', joinedAt: m.joinedAt, available: !!c && c.status === 'published' }
  })
  const cohorts = db.enrollments.filter((e) => e.userId === userId).map((e) => {
    const c = space(db, 'cohort', e.slug)
    return { slug: e.slug, name: nameOf(c, e.slug), status: e.status, enrolledAt: e.enrolledAt, withdrawnAt: e.withdrawnAt ?? null, available: !!c && c.status === 'published' }
  })
  const events = db.registrations.filter((r) => r.userId === userId).map((r) => {
    const e = db.events.find((x) => x.id === r.eventId)
    return {
      slug: e?.slug ?? null, title: e?.title ?? 'This event is no longer available', category: e?.category ?? null, startDateTime: e?.startDateTime ?? null, endDateTime: e?.endDateTime ?? null,
      timeZone: e?.timeZone ?? null, format: e?.format ?? null, host: e?.speakers?.[0]?.name ?? null, eventStatus: e?.status ?? 'unavailable',
      status: r.status, registeredAt: r.createdAt, available: !!e && e.status !== 'draft' && e.status !== 'archived',
      attended: r.status === 'attended' ? true : null, // shown only when staff actually recorded it
    }
  })
  return { communities, cohorts, events }
}

// A profile as another person may see it. Anything not allowed by the owner's settings is simply absent.
function publicProfile(db, u, viewer) {
  const s = settingsOf(u)
  const out = { id: u.id, name: u.name, username: u.username ?? null, headline: u.headline ?? '', skills: u.skills ?? [], links: u.links ?? [], avatarUrl: avatarUrl(u), memberSince: u.createdAt }
  if ((u.bioStatus ?? 'published') === 'published') out.bio = u.bio ?? ''
  if (s.showInterests) out.interests = u.interests ?? []
  if (s.showLocation && u.location) out.location = u.location
  if (s.showCommunities) out.communities = db.memberships.filter((m) => m.userId === u.id && m.status === 'active').map((m) => ({ slug: m.slug, name: nameOf(space(db, 'community', m.slug), m.slug) }))
  if (s.showEmail && viewer) out.email = u.email // only when the owner chose to, and only to signed-in members
  return out
}
const canSee = (u, viewer) => u.status === 'active' && (!!viewer && (viewer.id === u.id) || settingsOf(u).visibility === 'public' || (settingsOf(u).visibility === 'members' && !!viewer))

const textBits = (d) => [d.headline, d.location, ...(d.interests ?? []), ...(d.skills ?? []), ...(d.links ?? []).map((l) => l.label)].filter(Boolean).join(' ')

export function register(router, { store, limiters, storage }) {
  const blankToNull = (b, keys) => Object.fromEntries(Object.entries(b ?? {}).map(([k, v]) => [k, keys.includes(k) && typeof v === 'string' && v.trim() === '' ? null : v]))

  /* ---------- own profile ---------- */
  router.get('/api/me/profile', ({ user }) => ({ user: memberView(store.read(), user) }))

  // Only these fields can be changed. Role, status, verification, email and phone are not accepted here:
  // email and phone changes need a verification workflow that this site does not have yet.
  router.patch('/api/me/profile', { participate: true, write: true }, ({ body, user, auditIn }) => {
    const data = validate(blankToNull(body, ['username', 'headline', 'bio', 'location']), {
      name: str({ min: 2, max: 80 }), username: str({ max: 30, nullable: true, optional: true }), headline: str({ max: 80, nullable: true, optional: true }), bio: str({ max: 300, nullable: true, optional: true }),
      location: str({ max: 60, nullable: true, optional: true }), interests: list(str({ min: 1, max: 30 }), { max: 12 }), skills: list(str({ min: 1, max: 30 }), { max: 15 }),
      links: list(obj({ label: str({ min: 1, max: 30 }), url: str({ min: 8, max: 200 }) }), { max: 3 }),
    }, { partial: true })
    const errors = {}
    if (data.username) {
      const name = data.username.toLowerCase()
      if (!USERNAME.test(name)) errors.username = 'Use 3 to 30 lowercase letters, numbers or underscores.'
      else if (RESERVED.includes(name)) errors.username = 'That username is reserved.'
      data.username = name
    }
    if (data.links) {
      const fixed = data.links.map((l) => ({ label: l.label, url: safeLink(l.url) }))
      if (fixed.some((l) => !l.url || !l.url.startsWith('https://'))) errors.links = 'Links must start with https://.'
      else data.links = fixed
    }
    if (Object.keys(errors).length) throw badRequest('Check the highlighted fields.', errors)
    const risky = screenContent(textBits(data))
    if (risky.verdict !== 'published') throw badRequest('Some of that text cannot be saved. Please rephrase it.', { headline: 'Please rephrase.' })

    return store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      if (data.username && d.users.some((x) => x.id !== u.id && (x.username ?? '').toLowerCase() === data.username)) throw conflict('That username is taken.', { username: 'Already taken.' })
      const before = { name: u.name, username: u.username ?? null, headline: u.headline ?? null, bio: u.bio ?? null, location: u.location ?? null, interests: u.interests ?? [], skills: u.skills ?? [], links: u.links ?? [] }
      for (const k of ['name', 'username', 'headline', 'location']) if (k in data) { if (data[k] === null) delete u[k]; else u[k] = data[k] }
      for (const k of ['interests', 'skills', 'links']) if (k in data) u[k] = data[k]
      if ('bio' in data) {
        const text = cleanText(data.bio ?? '', { max: 300 }) ?? ''
        const screen = screenContent(text)
        u.bio = text
        u.bioStatus = screen.verdict // a flagged bio stays hidden from others until a person has looked at it
        if (screen.verdict !== 'published') d.reports.push({ id: randomUUID(), ref: newRef(), contentType: 'profile', contentId: u.id, reason: screen.flags[0].reason === 'threat' ? 'harassment_threats' : 'other', details: '', reporterId: null, source: 'system', flags: screen.flags, severity: screen.verdict === 'restricted' ? 'critical' : 'medium', status: 'open', createdAt: new Date().toISOString() })
      }
      const after = { name: u.name, username: u.username ?? null, headline: u.headline ?? null, bio: u.bio ?? null, location: u.location ?? null, interests: u.interests ?? [], skills: u.skills ?? [], links: u.links ?? [] }
      const changed = Object.keys(diff(before, after))
      if (changed.length) { logActivity(d, u.id, 'profile_updated', { kind: 'profile', slug: null, title: 'Profile' }, { fields: changed }); auditIn(d, 'member.profile_update', 'user', u.id, { fields: { from: null, to: changed } }) }
      return { user: memberView(d, u), held: u.bioStatus !== 'published' }
    })
  })

  router.patch('/api/me/settings', ({ body, user, auditIn }) => {
    const data = validate(body, { visibility: oneOf(['private', 'members', 'public']), showInterests: bool(), showCommunities: bool(), showEmail: bool(), showLocation: bool(), notifyEmail: bool(), notifyEvents: bool() }, { partial: true })
    return store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      const before = settingsOf(u)
      u.settings = { ...before, ...data }
      auditIn(d, 'member.settings_update', 'user', u.id, diff(before, u.settings))
      return { settings: u.settings }
    })
  })

  /* ---------- avatar ---------- */
  router.put('/api/me/avatar', ({ body, user, auditIn }) => {
    limiters.content.hit(`av:${user.id}`)
    const { image } = validate(body, { image: str({ min: 20, max: Math.ceil(AVATAR_MAX_BYTES * 1.4) + 100, trim: false }) })
    const m = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image)
    if (!m) throw badRequest('Choose a PNG, JPEG or WebP image.', { image: 'Unsupported image.' })
    const buf = Buffer.from(m[1], 'base64')
    if (buf.length > AVATAR_MAX_BYTES) throw badRequest('That image is too large (400 KB maximum).', { image: 'Too large.' })
    const kind = sniffImage(buf) // trust the bytes, not what the browser claimed
    if (!kind) throw badRequest('That file is not a valid PNG, JPEG or WebP image.', { image: 'Not a valid image.' })
    const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)
    const file = `${user.id}-${hash}.${kind.ext}`
    storage.put(file, buf)
    return store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      if (u.avatar && u.avatar.file !== file) storage.remove(u.avatar.file)
      u.avatar = { file, type: kind.type, hash }
      auditIn(d, 'member.avatar_update', 'user', u.id)
      return { avatarUrl: avatarUrl(u) }
    })
  })

  router.delete('/api/me/avatar', ({ user, auditIn }) => store.transaction((d) => {
    const u = d.users.find((x) => x.id === user.id)
    if (u.avatar) { storage.remove(u.avatar.file); delete u.avatar }
    auditIn(d, 'member.avatar_remove', 'user', u.id)
    return { ok: true }
  }))

  // Served only after the owner's visibility setting is checked, exactly like the public profile.
  router.get('/api/members/:id/avatar', { optional: true }, ({ params, user }) => {
    const u = store.read().users.find((x) => x.id === params.id)
    if (!u || !u.avatar || !canSee(u, user)) throw notFound('No picture.')
    const buf = storage.get(u.avatar.file)
    if (!buf) throw notFound('No picture.')
    return { __buffer: buf, headers: { 'Content-Type': u.avatar.type, 'Cache-Control': 'private, no-cache', 'Content-Disposition': 'inline' } }
  })

  router.get('/api/members/:id', { optional: true }, ({ params, user }) => {
    const db = store.read()
    const u = db.users.find((x) => x.id === params.id)
    if (!u || !canSee(u, user)) throw notFound('This profile is private or does not exist.') // same answer for both
    return { profile: publicProfile(db, u, user), self: user?.id === u.id }
  })

  /* ---------- memberships, enrolments, registrations ---------- */
  router.get('/api/me/participation', { participate: true }, ({ user }) => participationOf(store.read(), user.id))

  router.post('/api/community/:slug/membership', { participate: true }, ({ params, user, auditIn }) => store.transaction((d) => {
    const c = published(d, 'community', params.slug)
    if (!c) throw notFound('That community was not found.')
    let m = d.memberships.find((x) => x.userId === user.id && x.slug === params.slug)
    if (m?.status === 'active') return { ok: true, membership: 'member', joinedAt: m.joinedAt } // joining twice changes nothing
    if (m) Object.assign(m, { status: 'active', joinedAt: new Date().toISOString(), leftAt: null })
    else { m = { id: randomUUID(), userId: user.id, slug: params.slug, status: 'active', joinedAt: new Date().toISOString() }; d.memberships.push(m) }
    logActivity(d, user.id, 'community_joined', { kind: 'community', slug: c.slug, title: c.name })
    auditIn(d, 'membership.join', 'memberships', m.id)
    return { ok: true, membership: 'member', joinedAt: m.joinedAt }
  }))

  router.delete('/api/community/:slug/membership', { participate: true }, ({ params, user, auditIn }) => store.transaction((d) => {
    const m = d.memberships.find((x) => x.userId === user.id && x.slug === params.slug && x.status === 'active')
    if (!m) return { ok: true } // already not a member
    m.status = 'left'; m.leftAt = new Date().toISOString()
    logActivity(d, user.id, 'community_left', { kind: 'community', slug: m.slug, title: nameOf(space(d, 'community', m.slug), m.slug) })
    auditIn(d, 'membership.leave', 'memberships', m.id)
    return { ok: true }
  }))

  router.post('/api/cohorts/:slug/enrollment', { participate: true }, ({ params, user, auditIn }) => store.transaction((d) => {
    const c = published(d, 'cohort', params.slug)
    if (!c) throw notFound('That cohort was not found.')
    let e = d.enrollments.find((x) => x.userId === user.id && x.slug === params.slug)
    if (e?.status === 'enrolled') return { ok: true, enrollment: 'enrolled' }
    if (e) Object.assign(e, { status: 'enrolled', enrolledAt: new Date().toISOString(), withdrawnAt: null })
    else { e = { id: randomUUID(), userId: user.id, slug: params.slug, status: 'enrolled', enrolledAt: new Date().toISOString() }; d.enrollments.push(e) }
    logActivity(d, user.id, 'cohort_enrolled', { kind: 'cohort', slug: c.slug, title: c.name })
    auditIn(d, 'enrollment.enrol', 'enrollments', e.id)
    return { ok: true, enrollment: 'enrolled' }
  }))

  router.delete('/api/cohorts/:slug/enrollment', { participate: true }, ({ params, user, auditIn }) => store.transaction((d) => {
    const e = d.enrollments.find((x) => x.userId === user.id && x.slug === params.slug && x.status === 'enrolled')
    if (!e) return { ok: true }
    e.status = 'withdrawn'; e.withdrawnAt = new Date().toISOString()
    logActivity(d, user.id, 'cohort_withdrawn', { kind: 'cohort', slug: e.slug, title: nameOf(space(d, 'cohort', e.slug), e.slug) })
    auditIn(d, 'enrollment.withdraw', 'enrollments', e.id)
    return { ok: true }
  }))

  router.post('/api/community/events/:slug/register', { participate: true }, ({ params, body, user, auditIn }) => {
    const { note } = validate(body ?? {}, { note: str({ max: 300, optional: true }) })
    return store.transaction((d) => {
      if ((d.settings['features.eventRegistration'] ?? true) === false) throw conflict('Event registration is paused.')
      const event = d.events.find((e) => e.slug === params.slug)
      if (!event) throw notFound('That event was not found.')
      const reg = registerFor(d, event, { name: user.name, email: user.email, note, userId: user.id }) // identity comes from the account, not the request
      logActivity(d, user.id, 'event_registered', { kind: 'event', slug: event.slug, title: event.title })
      auditIn(d, 'registration.create', 'registrations', reg.id)
      return { status: 201, body: { ok: true, status: reg.status, registeredAt: reg.createdAt } }
    })
  })

  // Cancel your own registration. Not possible once the event has started or has been cancelled by the organisers.
  router.delete('/api/community/events/:slug/register', { participate: true }, ({ params, user, auditIn }) => store.transaction((d) => {
    const event = d.events.find((e) => e.slug === params.slug)
    if (!event) throw notFound('That event was not found.')
    const reg = d.registrations.find((r) => r.eventId === event.id && r.userId === user.id && r.status === 'registered')
    if (!reg) throw notFound('You are not registered for this event.')
    if (event.status === 'cancelled') throw conflict('This event was cancelled by the organisers.')
    if (Date.now() >= Date.parse(event.startDateTime)) throw conflict('This event has already started, so the registration can no longer be cancelled.')
    reg.status = 'cancelled'; reg.updatedAt = new Date().toISOString()
    logActivity(d, user.id, 'event_cancelled', { kind: 'event', slug: event.slug, title: event.title })
    auditIn(d, 'registration.cancel', 'registrations', reg.id)
    return { ok: true }
  }))

  /* ---------- activity (own only) ---------- */
  router.get('/api/me/activity', ({ query, user }) => {
    const rows = store.read().activity.filter((a) => a.userId === user.id).sort((a, b) => b.at.localeCompare(a.at))
    const page = paginate(rows, query, { defaultSize: 20, maxSize: 50 })
    return { ...page, items: page.items.map(({ userId, ...a }) => a) }
  })

  /* ---------- account ---------- */
  router.post('/api/auth/change-password', async ({ body, user, session, limiters: lim, auditIn }) => {
    const { currentPassword, newPassword } = validate(body, { currentPassword: str({ min: 1, max: 200, trim: false }), newPassword: str({ min: 1, max: 200, trim: false }) })
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw badRequest('Your current password is incorrect.', { currentPassword: 'Incorrect.' })
    const problem = passwordProblem(newPassword)
    if (problem) throw badRequest(problem, { newPassword: problem })
    if (newPassword === currentPassword) throw badRequest('Choose a new password.', { newPassword: 'Must be different.' })
    const passwordHash = await hashPassword(newPassword)
    store.transaction((d) => {
      const u = d.users.find((x) => x.id === user.id)
      u.passwordHash = passwordHash
      d.sessions = d.sessions.filter((s) => s.userId !== u.id || s.id === session.id) // other devices are signed out
      ;(lim ?? limiters).login.resetWhere((k) => k.endsWith(`|${u.email}`))
      auditIn(d, 'auth.password_change', 'user', u.id)
    })
    return { ok: true }
  })

  // A request for staff to act on, recorded as an enquiry. The account is not deactivated automatically.
  router.post('/api/me/deactivation-request', ({ body, user, auditIn }) => {
    const { reason } = validate(body ?? {}, { reason: str({ max: 500, optional: true }) })
    return store.transaction((d) => {
      const open = d.enquiries.find((e) => e.type === 'deactivation' && e.userId === user.id && ['new', 'in_progress'].includes(e.status))
      if (open) return { ok: true, message: 'Your request is already with our team.' }
      d.enquiries.push({ id: randomUUID(), type: 'deactivation', userId: user.id, name: user.name, email: user.email, message: reason || 'Please deactivate my account.', status: 'new', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      auditIn(d, 'account.deactivation_requested', 'user', user.id)
      return { status: 201, body: { ok: true, message: 'Your request was sent. Our team will follow up by email.' } }
    })
  })
}
