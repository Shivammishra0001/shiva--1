// Events and registrations. Lifecycle and cross-field rules live in lib/eventRules.js.
import { registerResource, slugField } from '../lib/resource.js'
import { date, int, list, obj, oneOf, str, email, validate } from '../lib/validate.js'
import { conflict, notFound } from '../lib/errors.js'
import { matches, paginate } from '../lib/list.js'
import { EVENT_STATUSES, EVENT_TRANSITIONS, checkEvent, eventStats, registerFor, seatsTaken } from '../lib/eventRules.js'

const schema = {
  title: str({ min: 3, max: 140 }), slug: slugField, category: str({ min: 2, max: 40 }), shortDescription: str({ min: 10, max: 300 }), overview: str({ max: 3000, optional: true }),
  topics: list(str({ min: 1, max: 120 }), { max: 20, optional: true }),
  speakers: list(obj({ name: str({ min: 2, max: 80 }), role: str({ max: 80, optional: true }) }), { max: 20, optional: true }),
  format: oneOf(['Online', 'In-person', 'Hybrid']), venueName: str({ max: 160, optional: true }), timeZone: str({ min: 3, max: 60 }),
  startDateTime: date(), endDateTime: date(), registrationOpensAt: date({ optional: true }), registrationDeadline: date({ optional: true }),
  capacity: int({ min: 1, max: 100000, optional: true, nullable: true }),
}

export function register(router, deps) {
  const { store } = deps
  registerResource(router, deps, {
    base: '/api/admin/events', collection: 'events', perm: 'events', label: 'Event', schema: Object.fromEntries(Object.entries(schema)),
    statuses: EVENT_STATUSES, transitions: EVENT_TRANSITIONS, publishTargets: ['published', 'registration_closed', 'completed'],
    actionFor: (to) => (to === 'cancelled' ? 'cancel' : 'update'), search: ['title', 'slug', 'category'], sorts: ['title', 'startDateTime', 'updatedAt'],
    check: (d, next, prev) => checkEvent(d, next, prev),
    guard: (d, row, to, { reason }) => {
      const now = Date.now()
      if (to === 'cancelled' && (!reason || reason.length < 3)) throw conflict('Give a reason for cancelling.', { reason: 'Required.' })
      if (to === 'published' && row.status === 'draft' && Date.parse(row.endDateTime) <= now) throw conflict('An event that has already ended cannot be published.')
      if (to === 'completed' && Date.parse(row.endDateTime) > now) throw conflict('An event can only be completed after it ends.')
      if (to === 'draft' && seatsTaken(d, row.id) > 0) throw conflict('This event has registrations. Cancel it instead of unpublishing.')
    },
    onTransition: (_d, row, to, { reason }) => {
      if (to === 'cancelled') { row.cancelledAt = new Date().toISOString(); row.cancelReason = reason; return { notifications: 'No notification provider is configured, so registrants were not told. Contact them directly.' } }
      return {}
    },
    extraView: (db, row) => ({ stats: eventStats(db, row) }),
    beforeDelete: (d, row) => { if (d.registrations.some((r) => r.eventId === row.id)) throw conflict('This event has registrations. Cancel and archive it instead of deleting.') },
  })

  const findEvent = (db, id) => { const e = db.events.find((x) => x.id === id); if (!e) throw notFound('Event not found.'); return e }

  router.get('/api/admin/events/:id/registrations', { perm: 'registrations.read' }, ({ params, query }) => {
    const db = store.read()
    const event = findEvent(db, params.id)
    const rows = db.registrations.filter((r) => r.eventId === event.id && (!query.status || r.status === query.status)).filter(matches(query, ['name', 'email']))
    return { ...paginate(rows, query), stats: eventStats(db, event) }
  })

  router.post('/api/admin/events/:id/registrations', { perm: 'registrations.manage' }, ({ params, body, auditIn }) => {
    const data = validate(body, { name: str({ min: 2, max: 80 }), email: email(), note: str({ max: 300, optional: true }) })
    return store.transaction((d) => {
      const reg = registerFor(d, findEvent(d, params.id), data)
      auditIn(d, 'registration.create', 'registrations', reg.id)
      return { status: 201, body: { registration: reg } }
    })
  })

  // registered <-> attended / no_show, or cancelled. Attendance can only be recorded once the event has started.
  router.patch('/api/admin/events/:id/registrations/:rid', { perm: 'registrations.manage' }, ({ params, body, auditIn }) => {
    const { status } = validate(body, { status: oneOf(['registered', 'attended', 'no_show', 'cancelled']) })
    return store.transaction((d) => {
      const event = findEvent(d, params.id)
      const reg = d.registrations.find((r) => r.id === params.rid && r.eventId === event.id)
      if (!reg) throw notFound('Registration not found.')
      if (['attended', 'no_show'].includes(status) && Date.parse(event.startDateTime) > Date.now()) throw conflict('Attendance can only be recorded after the event starts.')
      if (status === 'registered' && reg.status === 'cancelled') {
        if (event.capacity != null && seatsTaken(d, event.id) >= event.capacity) throw conflict('This event is full.')
        if (event.status !== 'published') throw conflict('Registration is not open for this event.')
      }
      const from = reg.status
      reg.status = status
      reg.updatedAt = new Date().toISOString()
      auditIn(d, 'registration.update', 'registrations', reg.id, { status: { from, to: status } })
      return { registration: reg, stats: eventStats(d, event) }
    })
  })
}
