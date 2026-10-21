// Generic admin CRUD + lifecycle for a collection (communities, cohorts, projects, ...).
// Each resource supplies: collection, permission prefix, a field schema, a transition map and optional hooks.
// Every write runs in one transaction together with its audit record.
import { randomUUID } from 'node:crypto'
import { conflict, forbidden, notFound } from './errors.js'
import { diff } from './audit.js'
import { matches, paginate, sortBy } from './list.js'
import { str, validate, oneOf, bool } from './validate.js'
import { can } from '../auth/access.js'

export const slugField = str({ min: 2, max: 60, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: 'Use lowercase letters, numbers and hyphens.' })

export function registerResource(router, { store }, def) {
  const { base, collection, perm, schema, transitions, statuses, publishTargets = [], search = ['name', 'slug'], sorts = ['name', 'createdAt', 'updatedAt'], label, beforeDelete, onTransition, extraView } = def
  const need = (action) => `${perm}.${action}`
  // `allowedTransitions` lets the UI offer only legal moves without copying the lifecycle rules.
  const view = (db, row) => ({ ...row, allowedTransitions: transitions[row.status] ?? [], ...(extraView ? extraView(db, row) : {}) })
  const find = (db, id) => { const r = db[collection].find((x) => x.id === id); if (!r) throw notFound(`${label} not found.`); return r }
  const unique = (db, row, id) => { if (db[collection].some((x) => x.slug === row.slug && x.id !== id)) throw conflict('This slug is already in use.', { slug: 'Already in use.' }) }

  router.get(base, { perm: need('read') }, ({ query }) => {
    const db = store.read()
    let rows = db[collection].filter((r) => (!query.status || r.status === query.status) && (query.featured === undefined || String(!!r.featured) === query.featured)).filter(matches(query, search))
    rows = sortBy(rows, query, sorts, 'updatedAt')
    const page = paginate(rows, query)
    return { ...page, items: page.items.map((r) => view(db, r)), statuses }
  })

  router.get(`${base}/:id`, { perm: need('read') }, ({ params }) => { const db = store.read(); return { item: view(db, find(db, params.id)), statuses } })

  router.post(base, { perm: need('create') }, ({ body, user, auditIn }) => {
    const data = validate(body, schema)
    return store.transaction((d) => {
      unique(d, data)
      const now = new Date().toISOString()
      const row = { id: randomUUID(), ...data, featured: false, status: def.initialStatus ?? 'draft', createdAt: now, updatedAt: now, createdBy: user.id }
      def.check?.(d, row, null)
      d[collection].push(row)
      auditIn(d, `${label.toLowerCase()}.create`, collection, row.id, { name: { from: null, to: row.name ?? row.title } })
      return { status: 201, body: { item: view(d, row) } }
    })
  })

  router.patch(`${base}/:id`, { perm: need('update') }, ({ params, body, auditIn }) => {
    const data = validate(body, schema, { partial: true })
    return store.transaction((d) => {
      const row = find(d, params.id)
      const before = structuredClone(row)
      const next = { ...row, ...data }
      unique(d, next, row.id)
      def.check?.(d, next, row)
      Object.assign(row, data, { updatedAt: new Date().toISOString() })
      auditIn(d, `${label.toLowerCase()}.update`, collection, row.id, diff(before, row))
      return { item: view(d, row) }
    })
  })

  // Status changes only follow the transition map. Publishing-type changes need the `publish` permission.
  router.post(`${base}/:id/transition`, { perm: need('read') }, ({ params, body, user, auditIn }) => {
    const { to, reason } = validate(body, { to: oneOf(statuses), reason: str({ max: 300, optional: true }) })
    return store.transaction((d) => {
      // Permission first, so a user without it learns nothing about the item's state.
      const action = publishTargets.includes(to) ? 'publish' : (def.actionFor?.(to) ?? 'update')
      if (!can(d, user, need(action))) throw forbidden()
      const row = find(d, params.id)
      if (!transitions[row.status]?.includes(to)) throw conflict(`A ${label.toLowerCase()} cannot move from "${row.status}" to "${to}".`)
      def.guard?.(d, row, to, { reason, user })
      const before = { status: row.status }
      row.status = to
      row.updatedAt = new Date().toISOString()
      if (reason) row.lastReason = reason
      const note = onTransition?.(d, row, to, { reason, user }) ?? {}
      auditIn(d, `${label.toLowerCase()}.${to}`, collection, row.id, { ...diff(before, { status: to }), ...(reason ? { reason: { from: null, to: reason } } : {}) })
      return { item: view(d, row), ...note }
    })
  })

  router.post(`${base}/:id/feature`, { perm: need('publish') }, ({ params, body, auditIn }) => {
    const { featured } = validate(body, { featured: bool() })
    return store.transaction((d) => {
      const row = find(d, params.id)
      if (featured && !['published', 'under_development', 'beta', 'market_ready'].includes(row.status)) throw conflict('Only published items can be featured.')
      const before = { featured: !!row.featured }
      row.featured = featured
      row.updatedAt = new Date().toISOString()
      auditIn(d, `${label.toLowerCase()}.feature`, collection, row.id, diff(before, { featured }))
      return { item: view(d, row) }
    })
  })

  router.delete(`${base}/:id`, { perm: need('delete') }, ({ params, auditIn }) => store.transaction((d) => {
    const row = find(d, params.id)
    beforeDelete?.(d, row)
    d[collection] = d[collection].filter((x) => x.id !== row.id)
    auditIn(d, `${label.toLowerCase()}.delete`, collection, row.id, { name: { from: row.name ?? row.title, to: null } })
    return { ok: true }
  }))
}
