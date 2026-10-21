// Summary figures and CSV exports. Exports are permission-checked per dataset, limited to safe columns and audited.
import { forbidden, notFound } from '../lib/errors.js'
import { can, rolesOf } from '../auth/access.js'

// Spreadsheet formula injection guard: values starting with = + - @ are prefixed.
const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"` }
const csv = (header, rows) => [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n')

const EXPORTS = {
  users: { perm: 'users.read', header: ['Name', 'Email', 'Status', 'Roles', 'Created'], rows: (db) => db.users.filter((u) => u.status !== 'deleted').map((u) => [u.name, u.email, u.status, rolesOf(db, u).map((r) => r.name).join('; '), u.createdAt]) },
  registrations: { perm: 'registrations.read', header: ['Event', 'Name', 'Email', 'Status', 'Registered'], rows: (db) => db.registrations.map((r) => [db.events.find((e) => e.id === r.eventId)?.title ?? '', r.name, r.email, r.status, r.createdAt]) },
  enquiries: { perm: 'enquiries.read', header: ['Type', 'Name', 'Email', 'Status', 'Received'], rows: (db) => db.enquiries.map((e) => [e.type, e.name, e.email, e.status, e.createdAt]) },
}

export function register(router, { store }) {
  router.get('/api/admin/reports/summary', { perm: 'reports.read' }, ({ user }) => {
    const db = store.read()
    const count = (list, key) => list.reduce((m, x) => ({ ...m, [x[key]]: (m[x[key]] ?? 0) + 1 }), {})
    return {
      projectsByStatus: can(db, user, 'projects.read') ? count(db.projects, 'status') : null,
      eventsByStatus: can(db, user, 'events.read') ? count(db.events, 'status') : null,
      enquiriesByStatus: can(db, user, 'enquiries.read') ? count(db.enquiries, 'status') : null,
      registrationsPerEvent: can(db, user, 'registrations.read') ? db.events.map((e) => ({ id: e.id, title: e.title, registered: db.registrations.filter((r) => r.eventId === e.id && r.status !== 'cancelled').length, capacity: e.capacity ?? null })).filter((e) => e.registered > 0 || e.capacity) : null,
      usersByRole: can(db, user, 'users.read') ? db.roles.map((r) => ({ role: r.name, users: db.users.filter((u) => u.status !== 'deleted' && u.roleIds.includes(r.id)).length })) : null,
    }
  })

  router.get('/api/admin/reports/export/:type', { perm: 'reports.export' }, ({ params, user, audit }) => {
    const def = EXPORTS[params.type]
    if (!def) throw notFound('Unknown export.')
    const db = store.read()
    if (!can(db, user, def.perm)) throw forbidden()
    const rows = def.rows(db)
    audit('export.create', 'reports', params.type, { rows: { from: null, to: rows.length } })
    return { __raw: true, text: csv(def.header, rows), headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${params.type}.csv"` } }
  })
}
