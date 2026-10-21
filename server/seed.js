// Start-up seeding. Safe to run on every start: it only fills in what is missing.
//  - roles from the templates (Super Admin always holds every permission)
//  - the first Super Admin, from ADMIN_EMAIL / ADMIN_PASSWORD in server/.env
//  - communities, cohorts, events and projects copied once from src/data so the admin starts with the live site's content
import { randomUUID } from 'node:crypto'
import { ROLE_TEMPLATES, ALL_PERMISSIONS } from './auth/permissions.js'
import { hashPasswordSync, passwordProblem } from './lib/crypto.js'
import { communities, cohorts } from '../src/data/communities.js'
import { events } from '../src/data/events.js'
import { projects } from '../src/data/projects.js'

const now = () => new Date().toISOString()
const DEFAULT_RULES = ['Be respectful. Disagree with ideas, not people.', 'No spam or unsolicited promotion.', 'Share useful technical knowledge.', 'Clearly label promotional content.', 'Respect licences and give attribution.']

const fromCommunity = (c) => ({ id: randomUUID(), name: c.name, slug: c.slug, tagline: c.tagline ?? '', about: c.about, group: c.group ?? '', accent: c.accent, logo: c.logo, topics: c.topics ?? [], rules: c.rules ?? DEFAULT_RULES, moderatorIds: [], featured: false, status: 'published', createdAt: now(), updatedAt: now(), seeded: true })
const EVENT_STATUS = { registration_open: 'published', published: 'published', registration_closed: 'registration_closed', completed: 'completed', cancelled: 'cancelled', draft: 'draft' }
const fromEvent = (e) => ({
  id: randomUUID(), title: e.title, slug: e.slug, category: e.category, shortDescription: e.shortDescription, overview: e.overview ?? '', topics: e.topics ?? [],
  speakers: (e.speakers ?? []).map((s) => ({ name: s.name, role: s.role ?? '' })), format: e.format, venueName: e.venueName ?? '', timeZone: e.timeZone ?? 'Asia/Kolkata',
  startDateTime: new Date(e.startDateTime).toISOString(), endDateTime: new Date(e.endDateTime).toISOString(),
  registrationOpensAt: undefined, registrationDeadline: e.registrationDeadline ? new Date(e.registrationDeadline).toISOString() : undefined, capacity: e.capacity ?? null,
  featured: !!e.featured, status: EVENT_STATUS[e.status] ?? 'draft', sampleNote: e.sampleNote, createdAt: now(), updatedAt: now(), seeded: true,
})
const PROJECT_STATUS = { beta: 'beta', development: 'under_development', market: 'market_ready' }
// Market Ready is never seeded: nothing has been verified, so those records start as Beta/Under development.
const fromProject = (p) => ({
  id: randomUUID(), name: p.name, slug: p.slug, category: p.category, summary: p.summary, problem: p.problem, solution: p.solution, audience: p.audience, stage: p.stage,
  availability: p.availability, features: p.features ?? [], tech: p.tech ?? [], team: p.team ?? [], sample: true, featured: false,
  status: PROJECT_STATUS[p.status] === 'market_ready' ? 'beta' : PROJECT_STATUS[p.status] ?? 'under_development', published: true,
  statusHistory: [{ status: PROJECT_STATUS[p.status] ?? 'under_development', at: now(), by: null, note: 'Imported from the public site content' }], createdAt: now(), updatedAt: now(), seeded: true,
})

export function seedAll(store, config) {
  store.transaction((db) => {
    for (const t of ROLE_TEMPLATES) {
      const have = db.roles.find((r) => r.key === t.key)
      if (!have) db.roles.push({ id: randomUUID(), key: t.key, name: t.name, description: t.description, system: t.system, permissions: [...t.permissions] })
      else if (t.key === 'super_admin') have.permissions = [...ALL_PERMISSIONS] // new permissions reach the Super Admin automatically
      else if (have.system) {
        // A permission introduced after this database was created is added to the system roles that should have it, once.
        // Permissions an admin removed earlier are not re-added.
        const seen = new Set(db.meta.permsSeen ?? [])
        have.permissions = [...new Set([...have.permissions, ...t.permissions.filter((p) => !seen.has(p))])]
      }
    }
    db.meta.permsSeen = [...ALL_PERMISSIONS]
    if (!db.users.length && config.adminEmail && config.adminPassword) {
      if (passwordProblem(config.adminPassword)) throw new Error(`ADMIN_PASSWORD is too weak: ${passwordProblem(config.adminPassword)}`)
      const role = db.roles.find((r) => r.key === 'super_admin')
      db.users.push({ id: randomUUID(), name: config.adminName, email: config.adminEmail.trim().toLowerCase(), passwordHash: hashPasswordSync(config.adminPassword), roleIds: [role.id], status: 'active', mustChangePassword: false, createdAt: now() })
    }
    const once = (key, fn) => { if (!db.meta[`seeded_${key}`]) { fn(); db.meta[`seeded_${key}`] = true } }
    once('communities', () => db.communities.push(...communities.map(fromCommunity)))
    once('cohorts', () => db.cohorts.push(...cohorts.map(fromCommunity)))
    once('events', () => db.events.push(...events.map(fromEvent)))
    once('projects', () => db.projects.push(...projects.map(fromProject)))
  })
}
