// Communities and cohorts share one workflow: Draft -> Published -> Archived.
import { registerResource, slugField } from '../lib/resource.js'
import { list, str } from '../lib/validate.js'
import { badRequest } from '../lib/errors.js'

const STATUSES = ['draft', 'published', 'archived']
const TRANSITIONS = { draft: ['published', 'archived'], published: ['draft', 'archived'], archived: ['draft'] }

const schema = {
  name: str({ min: 2, max: 80 }), slug: slugField, tagline: str({ max: 160, optional: true }), about: str({ min: 10, max: 2000 }),
  group: str({ max: 60, optional: true }), accent: str({ pattern: /^#[0-9a-fA-F]{6}$/, patternMessage: 'Use a colour like #f6dbc0.', optional: true }),
  logo: str({ max: 200, pattern: /^\/[\w./-]+$/, patternMessage: 'Use a site path like /logos/ai.svg.', optional: true }),
  topics: list(str({ min: 1, max: 60 }), { max: 20 }), rules: list(str({ min: 3, max: 200 }), { max: 20, optional: true }),
  moderatorIds: list(str({ max: 64 }), { max: 20, optional: true }),
}

// Moderators must be real, active accounts.
const checkModerators = (db, row) => {
  const bad = (row.moderatorIds ?? []).filter((id) => !db.users.some((u) => u.id === id && u.status === 'active'))
  if (bad.length) throw badRequest('Unknown moderator.', { moderatorIds: 'Choose active users.' })
}

export function register(router, deps) {
  for (const def of [
    { base: '/api/admin/communities', collection: 'communities', perm: 'communities', label: 'Community' },
    { base: '/api/admin/cohorts', collection: 'cohorts', perm: 'cohorts', label: 'Cohort' },
  ]) {
    registerResource(router, deps, { ...def, schema, statuses: STATUSES, transitions: TRANSITIONS, publishTargets: ['published', 'archived'], check: checkModerators, search: ['name', 'slug', 'tagline'] })
  }
}
