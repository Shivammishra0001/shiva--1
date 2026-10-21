// Enquiries from the public forms: New -> In Progress -> Resolved -> Closed, with assignment and internal notes.
// Created through the public endpoint in public.js; managed here.
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { matches, paginate, sortBy } from '../lib/list.js'
import { oneOf, str, validate } from '../lib/validate.js'
import { can } from '../auth/access.js'

export const ENQUIRY_TYPES = ['contact', 'booking', 'event_proposal', 'community_request', 'advertising', 'project_interest', 'newsletter', 'deactivation']
const STATUSES = ['new', 'in_progress', 'resolved', 'closed']
const TRANSITIONS = { new: ['in_progress', 'closed'], in_progress: ['resolved', 'new', 'closed'], resolved: ['in_progress', 'closed'], closed: [] }

const find = (db, id) => { const e = db.enquiries.find((x) => x.id === id); if (!e) throw notFound('Enquiry not found.'); return e }

export function register(router, { store }) {
  router.get('/api/admin/enquiries', { perm: 'enquiries.read' }, ({ query }) => {
    const db = store.read()
    let rows = db.enquiries.filter((e) => (!query.status || e.status === query.status) && (!query.type || e.type === query.type) && (!query.assignee || e.assigneeId === query.assignee)).filter(matches(query, ['name', 'email', 'message']))
    rows = sortBy(rows, query, ['createdAt', 'status', 'type'], 'createdAt')
    return { ...paginate(rows, query), statuses: STATUSES, types: ENQUIRY_TYPES }
  })

  router.get('/api/admin/enquiries/:id', { perm: 'enquiries.read' }, ({ params }) => ({ item: find(store.read(), params.id) }))

  router.post('/api/admin/enquiries/:id/status', { perm: 'enquiries.manage' }, ({ params, body, auditIn }) => {
    const { status } = validate(body, { status: oneOf(STATUSES) })
    return store.transaction((d) => {
      const e = find(d, params.id)
      if (!TRANSITIONS[e.status].includes(status)) throw conflict(`An enquiry cannot move from "${e.status}" to "${status}".`)
      const from = e.status
      e.status = status
      e.updatedAt = new Date().toISOString()
      auditIn(d, 'enquiry.status', 'enquiries', e.id, { status: { from, to: status } })
      return { item: e }
    })
  })

  router.post('/api/admin/enquiries/:id/assign', { perm: 'enquiries.manage' }, ({ params, body, auditIn }) => {
    const { assigneeId } = validate(body, { assigneeId: str({ max: 64, nullable: true, optional: true }) })
    return store.transaction((d) => {
      const e = find(d, params.id)
      if (assigneeId) {
        const u = d.users.find((x) => x.id === assigneeId)
        if (!u || u.status !== 'active' || !can(d, u, 'enquiries.read')) throw badRequest('Choose an active staff member who can view enquiries.', { assigneeId: 'Not allowed.' })
      }
      const from = e.assigneeId ?? null
      e.assigneeId = assigneeId ?? null
      auditIn(d, 'enquiry.assign', 'enquiries', e.id, { assigneeId: { from, to: e.assigneeId } })
      return { item: e }
    })
  })

  router.post('/api/admin/enquiries/:id/notes', { perm: 'enquiries.manage' }, ({ params, body, user, auditIn }) => {
    const { note } = validate(body, { note: str({ min: 2, max: 1000 }) })
    return store.transaction((d) => {
      const e = find(d, params.id)
      e.notes = [...(e.notes ?? []), { at: new Date().toISOString(), by: user.id, byName: user.name, note }]
      auditIn(d, 'enquiry.note', 'enquiries', e.id)
      return { item: e }
    })
  })
}
