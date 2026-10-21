// Website content blocks with a draft -> publish workflow. Each editable block has a fixed key and field list.
// The public site can read published blocks from GET /api/public/content/:key (see public.js).
import { notFound, conflict } from '../lib/errors.js'
import { diff } from '../lib/audit.js'
import { str, validate } from '../lib/validate.js'

export const CONTENT_BLOCKS = {
  'home.hero': { label: 'Home page hero', fields: { title: str({ min: 3, max: 120 }), description: str({ max: 300, optional: true }), primaryCta: str({ max: 40, optional: true }), secondaryCta: str({ max: 40, optional: true }) } },
  'site.announcement': { label: 'Site announcement', fields: { text: str({ min: 3, max: 200 }), linkLabel: str({ max: 40, optional: true }), linkPath: str({ max: 120, pattern: /^\/[\w./?=&#-]*$/, patternMessage: 'Use a path on this site, like /community.html.', optional: true }) } },
  'site.contact': { label: 'Contact details', fields: { phone: str({ max: 30, optional: true }), email: str({ max: 120, optional: true }), location: str({ max: 160, optional: true }) } },
  'site.seo': { label: 'SEO and sharing', fields: { title: str({ min: 3, max: 70 }), description: str({ max: 170, optional: true }) } },
  'about.intro': { label: 'About page intro', fields: { heading: str({ min: 3, max: 120 }), body: str({ max: 1500, optional: true }) } },
  'faq.main': { label: 'FAQ', fields: { items: str({ max: 4000, optional: true }) } },
  'testimonials.main': { label: 'Testimonials', fields: { items: str({ max: 4000, optional: true }) } },
}

const view = (key, row) => ({ key, label: CONTENT_BLOCKS[key].label, fields: Object.keys(CONTENT_BLOCKS[key].fields), draft: row?.draft ?? null, published: row?.published ?? null, status: !row?.draft ? (row?.published ? 'published' : 'empty') : JSON.stringify(row.draft) === JSON.stringify(row.published) ? 'published' : 'draft', updatedAt: row?.updatedAt ?? null, publishedAt: row?.publishedAt ?? null })
const block = (key) => { if (!CONTENT_BLOCKS[key]) throw notFound('Unknown content block.'); return CONTENT_BLOCKS[key] }

export function register(router, { store }) {
  router.get('/api/admin/content', { perm: 'content.read' }, () => { const db = store.read(); return { items: Object.keys(CONTENT_BLOCKS).map((k) => view(k, db.content.find((c) => c.key === k))) } })

  router.put('/api/admin/content/:key', { perm: 'content.manage' }, ({ params, body, auditIn }) => {
    const def = block(params.key)
    const draft = validate(body, def.fields)
    return store.transaction((d) => {
      let row = d.content.find((c) => c.key === params.key)
      if (!row) { row = { key: params.key, draft: null, published: null }; d.content.push(row) }
      const before = row.draft ?? {}
      row.draft = draft
      row.updatedAt = new Date().toISOString()
      auditIn(d, 'content.draft', 'content', params.key, diff(before, draft))
      return { item: view(params.key, row) }
    })
  })

  router.post('/api/admin/content/:key/publish', { perm: 'content.manage' }, ({ params, auditIn }) => {
    block(params.key)
    return store.transaction((d) => {
      const row = d.content.find((c) => c.key === params.key)
      if (!row?.draft) throw conflict('There is no draft to publish.')
      const before = row.published ?? {}
      row.published = structuredClone(row.draft)
      row.publishedAt = new Date().toISOString()
      auditIn(d, 'content.publish', 'content', params.key, diff(before, row.published))
      return { item: view(params.key, row) }
    })
  })

  router.post('/api/admin/content/:key/discard', { perm: 'content.manage' }, ({ params, auditIn }) => {
    block(params.key)
    return store.transaction((d) => {
      const row = d.content.find((c) => c.key === params.key)
      if (!row) throw notFound('Nothing to discard.')
      row.draft = row.published ? structuredClone(row.published) : null
      auditIn(d, 'content.discard', 'content', params.key)
      return { item: view(params.key, row) }
    })
  })
}
