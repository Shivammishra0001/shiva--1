// Event rules shared by the admin API and the public registration endpoint.
import { conflict, badRequest } from './errors.js'

export const EVENT_STATUSES = ['draft', 'published', 'registration_closed', 'completed', 'cancelled', 'archived']
// Draft -> Published -> Registration Closed -> Completed; cancellation from any live state; archive when finished.
export const EVENT_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['registration_closed', 'completed', 'cancelled', 'draft'],
  registration_closed: ['published', 'completed', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
}

export const activeRegistrations = (db, eventId) => db.registrations.filter((r) => r.eventId === eventId && r.status !== 'cancelled')
export const seatsTaken = (db, eventId) => activeRegistrations(db, eventId).length

export function eventStats(db, event) {
  const regs = db.registrations.filter((r) => r.eventId === event.id)
  const registered = regs.filter((r) => r.status !== 'cancelled').length
  return { registered, attended: regs.filter((r) => r.status === 'attended').length, cancelled: regs.filter((r) => r.status === 'cancelled').length, capacity: event.capacity ?? null, remaining: event.capacity == null ? null : Math.max(0, event.capacity - registered) }
}

// Cross-field checks for create and update. `next` is the event as it would be saved.
export function checkEvent(db, next, previous) {
  const errors = {}
  const start = Date.parse(next.startDateTime)
  const end = Date.parse(next.endDateTime)
  if (end <= start) errors.endDateTime = 'The end must be after the start.'
  if (next.registrationOpensAt && next.registrationDeadline && Date.parse(next.registrationDeadline) < Date.parse(next.registrationOpensAt)) errors.registrationDeadline = 'The deadline must be after registration opens.'
  if (next.registrationDeadline && Date.parse(next.registrationDeadline) > end) errors.registrationDeadline = 'Registration must close before the event ends.'
  try { new Intl.DateTimeFormat('en', { timeZone: next.timeZone }) } catch { errors.timeZone = 'Unknown time zone.' }
  if (previous && next.capacity != null && next.capacity < seatsTaken(db, previous.id)) errors.capacity = `${seatsTaken(db, previous.id)} seats are already taken.`
  if (next.format !== 'Online' && !next.venueName) errors.venueName = 'Add the venue for in-person and hybrid events.'
  if (Object.keys(errors).length) throw badRequest('Check the highlighted fields.', errors)
}

// Used by admin "add registration" and the public registration endpoint. Call inside a transaction.
export function registerFor(db, event, { name, email, note, userId }, now = Date.now()) {
  if (event.status !== 'published') throw conflict(event.status === 'cancelled' ? 'This event was cancelled.' : 'Registration is not open for this event.')
  if (event.registrationOpensAt && now < Date.parse(event.registrationOpensAt)) throw conflict('Registration has not opened yet.')
  if (event.registrationDeadline && now > Date.parse(event.registrationDeadline)) throw conflict('The registration deadline has passed.')
  if (now >= Date.parse(event.endDateTime)) throw conflict('This event has finished.')
  if (db.registrations.some((r) => r.eventId === event.id && (r.email === email || (userId && r.userId === userId)) && r.status !== 'cancelled')) throw conflict('You are already registered.', { email: 'Already registered.' })
  if (event.capacity != null && seatsTaken(db, event.id) >= event.capacity) throw conflict('This event is full.', { capacity: 'Full.' })
  // Registering again after cancelling reuses the same record, so one person never has two records for one event.
  const prev = db.registrations.find((r) => r.eventId === event.id && r.status === 'cancelled' && (userId ? r.userId === userId : r.email === email))
  if (prev) { Object.assign(prev, { name, email, note: note ?? '', status: 'registered', createdAt: new Date(now).toISOString() }); return prev }
  const reg = { id: crypto.randomUUID(), eventId: event.id, userId: userId ?? null, name, email, note: note ?? '', status: 'registered', createdAt: new Date(now).toISOString() }
  db.registrations.push(reg)
  return reg
}
