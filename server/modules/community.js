// Member-facing community features: posts, comments, reports and appeals. Every route needs a signed-in member who has
// accepted the current policies; creating content also needs the account not to be restricted. Content is screened on the
// server BEFORE it is published (see lib/contentRules.js). Reporter identities are never returned to members.
import { randomUUID } from 'node:crypto'
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js'
import { oneOf, str, validate, email } from '../lib/validate.js'
import { cleanText, safeLink, screenContent } from '../lib/contentRules.js'
import { writeAudit } from '../lib/audit.js'
import { verifyPassword, burnPasswordCheck } from '../lib/crypto.js'
import { logActivity } from '../lib/activity.js'

export const REPORT_REASONS = {
  harassment_threats: { label: 'Harassment or threats', severity: 'high' },
  hate_abuse: { label: 'Hate or targeted abuse', severity: 'high' },
  privacy: { label: 'Privacy violation or doxxing', severity: 'high' },
  spam_scam: { label: 'Spam or scam', severity: 'low' },
  malicious: { label: 'Malicious content', severity: 'medium' },
  sexual_exploitation: { label: 'Sexual exploitation or prohibited imagery', severity: 'critical' },
  copyright: { label: 'Copyright concern', severity: 'medium' },
  other: { label: 'Other policy violation', severity: 'low' },
}
// Rule reasons from the screening layer map onto the same list.
const RULE_REASON = { spam: 'spam_scam', malicious: 'malicious', privacy: 'privacy', threat: 'harassment_threats', sexual_exploitation: 'sexual_exploitation' }
export const ruleReason = (r) => RULE_REASON[r] ?? 'other'

export const newRef = () => `RPT-${randomUUID().slice(0, 6).toUpperCase()}`
const preview = (t) => (t.length > 140 ? `${t.slice(0, 140)}…` : t)

const spaceExists = (db, slug) => [...db.communities, ...db.cohorts].some((c) => c.slug === slug && c.status === 'published')

// A post or comment as other members see it (and as its author sees it, with its review status).
function view(db, row, me, comments = []) {
  const author = db.users.find((u) => u.id === row.authorId)
  const mine = row.authorId === me.id
  return {
    id: row.id, content: row.content, link: row.link ?? null, createdAt: row.createdAt, parentId: row.parentId ?? null,
    author: { id: row.authorId, name: author?.name ?? 'Member' }, mine,
    ...(mine && row.status !== 'published' ? { status: row.status } : {}), comments,
  }
}
const visible = (row, me) => row.status === 'published' || (row.authorId === me.id && row.status !== 'removed')

export function holdIfFlagged(d, row, kind) {
  const screen = screenContent(`${row.content} ${row.link ?? ''}`)
  row.status = screen.verdict
  row.flags = screen.flags
  if (screen.verdict !== 'published') {
    d.reports.push({
      id: randomUUID(), ref: newRef(), contentType: kind, contentId: row.id, reason: ruleReason(screen.flags[0].reason), details: '', reporterId: null, source: 'system',
      flags: screen.flags, severity: screen.verdict === 'restricted' ? 'critical' : 'medium', status: 'open', createdAt: new Date().toISOString(),
    })
  }
  return screen
}

const HELD_MESSAGE = { pending_review: 'Your post is awaiting review before it appears.', restricted: 'Your post was held for urgent review and is not visible yet.' }

export function register(router, { store, config, limiters }) {
  router.get('/api/community/reasons', { public: true }, () => ({ items: Object.entries(REPORT_REASONS).map(([id, r]) => ({ id, label: r.label })) }))

  router.get('/api/community/:slug/posts', { participate: true }, ({ params, user }) => {
    const db = store.read()
    if (!spaceExists(db, params.slug)) throw notFound('This space was not found.')
    const posts = db.posts.filter((p) => p.communitySlug === params.slug && visible(p, user)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
    return { items: posts.map((p) => view(db, p, user, db.comments.filter((c) => c.postId === p.id && visible(c, user)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((c) => view(db, c, user)))) }
  })

  router.post('/api/community/:slug/posts', { participate: true, write: true }, ({ params, body, user, auditIn }) => {
    limiters.content.hit(`p:${user.id}`)
    const data = validate(body, { content: str({ min: 1, max: 5000 }), link: str({ max: 300, optional: true }) })
    const content = cleanText(data.content, { max: 5000 })
    if (!content) throw badRequest('Write something (up to 5000 characters).', { content: 'Invalid.' })
    const link = data.link ? safeLink(data.link) : null
    if (data.link && !link) throw badRequest('Use a full http or https link.', { link: 'Invalid link.' })
    return store.transaction((d) => {
      if (!spaceExists(d, params.slug)) throw notFound('This space was not found.')
      const row = { id: `sp-${randomUUID()}`, communitySlug: params.slug, authorId: user.id, content, link, status: 'published', createdAt: new Date().toISOString() }
      const screen = holdIfFlagged(d, row, 'post')
      d.posts.push(row)
      logActivity(d, user.id, 'post_created', { kind: 'post', slug: params.slug, title: (d.communities.find((c) => c.slug === params.slug) ?? d.cohorts.find((c) => c.slug === params.slug))?.name ?? params.slug }, { held: screen.verdict !== 'published' })
      auditIn(d, 'post.create', 'posts', row.id, screen.verdict === 'published' ? undefined : { status: { from: null, to: screen.verdict } })
      return { status: 201, body: { post: view(d, row, user), held: screen.verdict !== 'published', message: HELD_MESSAGE[screen.verdict] ?? null } }
    })
  })

  router.post('/api/community/posts/:id/comments', { participate: true, write: true }, ({ params, body, user, auditIn }) => {
    limiters.content.hit(`p:${user.id}`)
    const data = validate(body, { content: str({ min: 1, max: 1500 }), parentId: str({ max: 64, optional: true }) })
    const content = cleanText(data.content, { max: 1500 })
    if (!content) throw badRequest('Write a comment (up to 1500 characters).', { content: 'Invalid.' })
    return store.transaction((d) => {
      const post = d.posts.find((p) => p.id === params.id && p.status === 'published')
      if (!post) throw notFound('Post not found.')
      if (data.parentId && !d.comments.some((c) => c.id === data.parentId && c.postId === post.id)) throw badRequest('Reply target not found.')
      const row = { id: `sc-${randomUUID()}`, postId: post.id, parentId: data.parentId ?? null, authorId: user.id, content, status: 'published', createdAt: new Date().toISOString() }
      const screen = holdIfFlagged(d, row, 'comment')
      d.comments.push(row)
      logActivity(d, user.id, 'comment_created', { kind: 'post', slug: post.communitySlug, title: (d.communities.find((c) => c.slug === post.communitySlug) ?? d.cohorts.find((c) => c.slug === post.communitySlug))?.name ?? post.communitySlug }, { held: screen.verdict !== 'published' })
      auditIn(d, 'comment.create', 'comments', row.id, screen.verdict === 'published' ? undefined : { status: { from: null, to: screen.verdict } })
      return { status: 201, body: { comment: view(d, row, user), held: screen.verdict !== 'published', message: screen.verdict === 'published' ? null : 'Your comment is awaiting review before it appears.' } }
    })
  })

  /* ---------- reports ---------- */
  router.post('/api/community/reports', { participate: true }, ({ body, user, auditIn }) => {
    limiters.report.hit(`r:${user.id}`)
    const data = validate(body, { contentType: oneOf(['post', 'comment', 'profile']), contentId: str({ min: 3, max: 80 }), reason: oneOf(Object.keys(REPORT_REASONS)), details: str({ max: 500, optional: true }) })
    return store.transaction((d) => {
      const list = { post: d.posts, comment: d.comments, profile: d.users }[data.contentType]
      const target = list.find((x) => x.id === data.contentId)
      const authorId = data.contentType === 'profile' ? target?.id : target?.authorId
      if (!target || (data.contentType !== 'profile' && target.status === 'removed')) throw notFound('That content was not found.')
      if (authorId === user.id) throw conflict('You cannot report your own content.')
      const dup = d.reports.find((r) => r.contentId === data.contentId && r.reporterId === user.id)
      if (dup) return { status: 200, body: { ok: true, ref: dup.ref, message: 'You have already reported this. Our team will review it.' } }
      const report = { id: randomUUID(), ref: newRef(), contentType: data.contentType, contentId: data.contentId, reason: data.reason, details: cleanText(data.details ?? '', { max: 500 }) ?? '', reporterId: user.id, source: 'member', severity: REPORT_REASONS[data.reason].severity, status: 'open', createdAt: new Date().toISOString() }
      d.reports.push(report)
      // Several different people reporting holds the content for a person to review. It is never removed automatically.
      const reporters = new Set(d.reports.filter((r) => r.contentId === data.contentId && r.status === 'open' && r.reporterId).map((r) => r.reporterId))
      if (reporters.size >= config.reportThreshold && data.contentType !== 'profile' && target.status === 'published') target.status = 'pending_review'
      auditIn(d, 'report.create', 'reports', report.id)
      return { status: 201, body: { ok: true, ref: report.ref, message: 'Thank you. Your report was sent to our moderators. Your reference is ' + report.ref + '.' } }
    })
  })

  /* ---------- appeals ---------- */
  function openAppeal(d, user, action, message) {
    if (!action || action.targetUserId !== user.id) throw notFound('That decision was not found.')
    if (['dismiss', 'escalate'].includes(action.type)) throw conflict('This decision cannot be appealed.')
    if (action.appealStatus !== 'none') throw conflict('This decision has already been appealed.')
    const appeal = { id: randomUUID(), ref: `APL-${randomUUID().slice(0, 6).toUpperCase()}`, actionId: action.id, userId: user.id, message, status: 'open', createdAt: new Date().toISOString() }
    d.appeals.push(appeal)
    action.appealStatus = 'open'
    const row = action.contentType === 'post' ? d.posts.find((p) => p.id === action.contentId) : action.contentType === 'comment' ? d.comments.find((c) => c.id === action.contentId) : null
    if (row && ['removed', 'restricted'].includes(row.status)) { row.statusBeforeAppeal = row.status; row.status = 'under_appeal' }
    return appeal
  }

  router.post('/api/community/appeals', { participate: false }, ({ body, user, auditIn }) => {
    limiters.appeal.hit(`a:${user.id}`)
    const data = validate(body, { actionId: str({ min: 3, max: 64 }), message: str({ min: 10, max: 1000 }) })
    return store.transaction((d) => {
      const appeal = openAppeal(d, user, d.actions.find((a) => a.id === data.actionId), data.message)
      auditIn(d, 'appeal.create', 'appeals', appeal.id)
      return { status: 201, body: { ok: true, ref: appeal.ref, message: `Your appeal was received. Reference ${appeal.ref}. A different reviewer will look at it.` } }
    })
  })

  // A suspended person cannot sign in, so they appeal with their credentials. Same generic failure as sign-in.
  router.post('/api/auth/appeal', { public: true }, async ({ body, ip, requestId }) => {
    limiters.appeal.hit(`ap:${ip}`)
    limiters.loginEmail.hit(`m:${String(body?.email).toLowerCase()}`)
    const data = validate(body, { email: email(), password: str({ min: 1, max: 200, trim: false }), message: str({ min: 10, max: 1000 }) })
    const u = store.read().users.find((x) => x.email === data.email)
    const ok = u ? await verifyPassword(data.password, u.passwordHash) : (await burnPasswordCheck(data.password), false)
    if (!ok) throw unauthorized('Email or password is incorrect.')
    return store.transaction((d) => {
      const action = [...d.actions].reverse().find((a) => a.targetUserId === u.id && a.type === 'suspend_user' && a.appealStatus === 'none')
      if (!action) throw conflict('There is no suspension that can be appealed.')
      const appeal = openAppeal(d, u, action, data.message)
      writeAudit(d, { actor: u, action: 'appeal.create', resource: 'appeals', resourceId: appeal.id, requestId, ip })
      return { status: 201, body: { ok: true, ref: appeal.ref, message: `Your appeal was received. Reference ${appeal.ref}.` } }
    })
  })
}
