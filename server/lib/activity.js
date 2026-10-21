// A small structured activity log. Records are written at the moment something really happens (join, enrol, register,
// post, ...), and a person can only ever read their own. It is separate from the admin audit log, which is never shown to members.
import { randomUUID } from 'node:crypto'

const LINKS = {
  community: (slug) => `/community.html?c=${slug}`,
  cohort: (slug) => `/cohort.html?c=${slug}`,
  event: (slug) => `/community.html?event=${slug}`,
  post: (slug) => `/community.html?c=${slug}&tab=feed`,
  profile: () => '/profile.html',
}
export const linkFor = (kind, slug) => (LINKS[kind] ? LINKS[kind](slug) : null)

export function logActivity(db, userId, type, resource = null, extra = {}) {
  db.activity.push({ id: randomUUID(), userId, type, at: new Date().toISOString(), resource: resource && { ...resource, link: resource.link ?? linkFor(resource.kind, resource.slug) }, ...extra })
}
