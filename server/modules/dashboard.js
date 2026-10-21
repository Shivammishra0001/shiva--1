// Overview metrics, all computed from real records. Sections the user cannot read are left out.
import { can } from '../auth/access.js'

const dayKey = (iso) => iso.slice(0, 10)

export function register(router, { store }) {
  router.get('/api/admin/dashboard', ({ query, user }) => {
    const db = store.read()
    const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30
    const since = Date.now() - days * 86_400_000
    const now = Date.now()
    const out = { days, generatedAt: new Date().toISOString() }

    if (can(db, user, 'users.read')) {
      const live = db.users.filter((u) => u.status !== 'deleted')
      const perDay = {}
      live.filter((u) => Date.parse(u.createdAt) >= since).forEach((u) => { perDay[dayKey(u.createdAt)] = (perDay[dayKey(u.createdAt)] ?? 0) + 1 })
      out.users = { total: live.length, active: live.filter((u) => u.status === 'active').length, suspended: live.filter((u) => u.status === 'suspended').length, newInRange: live.filter((u) => Date.parse(u.createdAt) >= since).length, perDay }
    }
    if (can(db, user, 'communities.read')) out.communities = { published: db.communities.filter((c) => c.status === 'published').length, total: db.communities.length }
    if (can(db, user, 'cohorts.read')) out.cohorts = { published: db.cohorts.filter((c) => c.status === 'published').length, total: db.cohorts.length }
    if (can(db, user, 'events.read')) {
      const upcoming = db.events.filter((e) => ['published', 'registration_closed'].includes(e.status) && Date.parse(e.endDateTime) > now).sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime))
      const open = upcoming.filter((e) => e.status === 'published' && (!e.registrationDeadline || Date.parse(e.registrationDeadline) > now))
      out.events = {
        upcoming: upcoming.length, openRegistrations: open.length,
        registrations: db.registrations.filter((r) => r.status !== 'cancelled').length,
        next: upcoming.slice(0, 5).map((e) => ({ id: e.id, title: e.title, startDateTime: e.startDateTime, status: e.status, registered: db.registrations.filter((r) => r.eventId === e.id && r.status !== 'cancelled').length, capacity: e.capacity ?? null })),
      }
    }
    if (can(db, user, 'projects.read')) {
      out.projects = {
        published: db.projects.filter((p) => p.published).length, underDevelopment: db.projects.filter((p) => p.status === 'under_development').length,
        marketReady: db.projects.filter((p) => p.status === 'market_ready').length, total: db.projects.length,
      }
    }
    // Items waiting for a person to act.
    const pending = []
    if (can(db, user, 'projects.read')) db.projects.filter((p) => p.status === 'under_review').forEach((p) => pending.push({ type: 'project', id: p.id, title: p.name, note: 'Project under review', link: '/admin/projects' }))
    if (can(db, user, 'content.read')) db.content.filter((c) => c.draft && JSON.stringify(c.draft) !== JSON.stringify(c.published)).forEach((c) => pending.push({ type: 'content', id: c.key, title: c.key, note: 'Unpublished content draft', link: '/admin/content' }))
    out.pending = pending
    if (can(db, user, 'enquiries.read')) out.enquiries = { open: db.enquiries.filter((e) => ['new', 'in_progress'].includes(e.status)).length, new: db.enquiries.filter((e) => e.status === 'new').length }
    if (can(db, user, 'audit.read')) out.activity = db.auditLogs.slice(-10).reverse()
    return out
  })
}
