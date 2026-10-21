// Read-only view of the audit trail. There is deliberately no write, edit or delete route here.
import { matches, paginate } from '../lib/list.js'

export function register(router, { store }) {
  router.get('/api/admin/audit', { perm: 'audit.read' }, ({ query }) => {
    const db = store.read()
    const from = query.from ? Date.parse(query.from) : null
    const to = query.to ? Date.parse(query.to) + 86_400_000 : null
    const rows = db.auditLogs.filter((a) => (!query.action || a.action.startsWith(query.action)) && (!query.outcome || a.outcome === query.outcome) && (!query.resource || a.resource === query.resource) && (!query.actor || a.actorId === query.actor)
      && (from ? Date.parse(a.at) >= from : true) && (to ? Date.parse(a.at) < to : true)).filter(matches(query, ['actorEmail', 'action', 'resourceId'])).reverse()
    return paginate(rows, query, { defaultSize: 25 })
  })
}
