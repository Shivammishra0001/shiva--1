// Read-only public endpoints (published data only) and the public forms. No authentication, so every input is validated
// and the write endpoints are rate limited. The static site can adopt these gradually.
import { createHash } from 'node:crypto'
import { conflict, notFound } from '../lib/errors.js'
import { email, oneOf, str, validate } from '../lib/validate.js'
import { ENQUIRY_TYPES } from './enquiries.js'
import { registerFor } from '../lib/eventRules.js'
import { randomUUID } from 'node:crypto'

// Internal fields never leave the server through the public API.
const INTERNAL = ['createdBy', 'statusHistory', 'reviewNotes', 'evidence', 'lastReason']
const strip = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !INTERNAL.includes(k)))

export function register(router, { store, limiters }) {
  const published = (list) => list.filter((x) => x.status === 'published').map(strip)

  router.get('/api/public/communities', { public: true }, () => ({ items: published(store.read().communities) }))
  router.get('/api/public/cohorts', { public: true }, () => ({ items: published(store.read().cohorts) }))
  router.get('/api/public/projects', { public: true }, () => ({ items: store.read().projects.filter((p) => p.published).map(strip) }))
  router.get('/api/public/events', { public: true }, () => ({ items: store.read().events.filter((e) => ['published', 'registration_closed', 'completed', 'cancelled'].includes(e.status)).map(strip) }))
  router.get('/api/public/content/:key', { public: true }, ({ params }) => {
    const row = store.read().content.find((c) => c.key === params.key)
    if (!row?.published) throw notFound('No published content.')
    return { key: row.key, content: row.published, publishedAt: row.publishedAt }
  })
  router.get('/api/public/settings', { public: true }, () => { const s = store.read().settings; return { maintenance: !!s['site.maintenance'], communityJoin: s['features.communityJoin'] ?? true, eventRegistration: s['features.eventRegistration'] ?? true } })

  router.post('/api/public/enquiries', { public: true }, ({ body, ip }) => {
    limiters.publicForm.hit(`enq:${ip}`)
    if (body?.website) return { ok: true } // honeypot: bots fill the hidden field
    const data = validate(body, { type: oneOf(ENQUIRY_TYPES), name: str({ min: 2, max: 80 }), email: email(), message: str({ min: 5, max: 2000 }), projectId: str({ max: 64, optional: true }) })
    store.transaction((d) => {
      d.enquiries.push({ id: randomUUID(), ...data, status: 'new', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ipHash: createHash('sha256').update(ip).digest('hex').slice(0, 16) })
    })
    return { status: 201, body: { ok: true } }
  })

  router.post('/api/public/events/:slug/register', { public: true }, ({ params, body, ip }) => {
    limiters.publicForm.hit(`reg:${ip}`)
    const data = validate(body, { name: str({ min: 2, max: 80 }), email: email(), note: str({ max: 300, optional: true }) })
    return store.transaction((d) => {
      if ((d.settings['features.eventRegistration'] ?? true) === false) throw conflict('Event registration is paused.')
      const event = d.events.find((e) => e.slug === params.slug)
      if (!event) throw notFound('Event not found.')
      registerFor(d, event, data)
      return { status: 201, body: { ok: true } }
    })
  })
}
