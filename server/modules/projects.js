// Market Push projects. Status: draft, under_review, under_development, beta, market_ready, archived.
// "Market ready" needs evidence from an authorised reviewer; publishing is a separate, permission-checked step.
import { registerResource, slugField } from '../lib/resource.js'
import { bool, list, obj, str, validate } from '../lib/validate.js'
import { conflict, notFound } from '../lib/errors.js'
import { diff } from '../lib/audit.js'

const STATUSES = ['draft', 'under_review', 'under_development', 'beta', 'market_ready', 'archived']
const TRANSITIONS = {
  draft: ['under_review', 'under_development', 'archived'],
  under_review: ['draft', 'under_development', 'beta', 'market_ready', 'archived'],
  under_development: ['under_review', 'beta', 'archived'],
  beta: ['under_review', 'under_development', 'market_ready', 'archived'],
  market_ready: ['beta', 'under_development', 'archived'],
  archived: ['draft'],
}
const PUBLISHABLE = ['under_development', 'beta', 'market_ready']

const schema = {
  name: str({ min: 2, max: 80 }), slug: slugField, category: str({ min: 2, max: 40 }), summary: str({ min: 5, max: 200 }),
  problem: str({ max: 1000, optional: true }), solution: str({ max: 1500, optional: true }), audience: str({ max: 300, optional: true }),
  stage: str({ max: 200, optional: true }), availability: str({ max: 300, optional: true }),
  features: list(str({ min: 2, max: 160 }), { max: 20, optional: true }), tech: list(str({ min: 1, max: 40 }), { max: 20, optional: true }),
  team: list(obj({ name: str({ min: 2, max: 80 }), role: str({ max: 80, optional: true }) }), { max: 20, optional: true }),
  sample: bool({ optional: true }),
}

export function register(router, deps) {
  const { store } = deps
  registerResource(router, deps, {
    base: '/api/admin/projects', collection: 'projects', perm: 'projects', label: 'Project', schema, statuses: STATUSES, transitions: TRANSITIONS,
    initialStatus: 'draft', search: ['name', 'slug', 'category', 'summary'],
    // Moving to Market Ready needs the publish permission and written evidence; every change is kept in the history.
    actionFor: (to) => (to === 'market_ready' ? 'publish' : 'update'),
    guard: (_d, row, to, { reason }) => {
      if (to === 'market_ready' && (!reason || reason.length < 10)) throw conflict('Market Ready needs a written confirmation (at least 10 characters) of how availability was verified.', { reason: 'Required for Market Ready.' })
    },
    onTransition: (_d, row, to, { reason, user }) => {
      row.statusHistory = [...(row.statusHistory ?? []), { status: to, at: new Date().toISOString(), by: user.id, note: reason ?? null }]
      if (to === 'market_ready') row.evidence = { note: reason, confirmedBy: user.id, confirmedAt: new Date().toISOString() }
      if (!PUBLISHABLE.includes(to)) row.published = false // never leave a draft/archived project public
    },
    extraView: (db, row) => ({ interestCount: db.enquiries.filter((e) => e.projectId === row.id).length }),
  })

  // Publish or unpublish (separate from status so a reviewer can approve without exposing it yet).
  router.post('/api/admin/projects/:id/publish', { perm: 'projects.publish' }, ({ params, body, auditIn }) => {
    const { published } = validate(body, { published: bool() })
    return store.transaction((d) => {
      const row = d.projects.find((p) => p.id === params.id)
      if (!row) throw notFound('Project not found.')
      if (published && !PUBLISHABLE.includes(row.status)) throw conflict('Only projects that are under development, in beta or market ready can be published.')
      if (published && row.status === 'market_ready' && !row.evidence) throw conflict('Market Ready projects need confirmation evidence before publishing.')
      const before = { published: !!row.published }
      row.published = published
      row.updatedAt = new Date().toISOString()
      auditIn(d, published ? 'project.publish' : 'project.unpublish', 'projects', row.id, diff(before, { published }))
      return { item: row }
    })
  })

  router.post('/api/admin/projects/:id/notes', { perm: 'projects.update' }, ({ params, body, user, auditIn }) => {
    const { note } = validate(body, { note: str({ min: 2, max: 1000 }) })
    return store.transaction((d) => {
      const row = d.projects.find((p) => p.id === params.id)
      if (!row) throw notFound('Project not found.')
      row.reviewNotes = [...(row.reviewNotes ?? []), { at: new Date().toISOString(), by: user.id, byName: user.name, note }]
      auditIn(d, 'project.note', 'projects', row.id)
      return { item: row }
    })
  })
}
