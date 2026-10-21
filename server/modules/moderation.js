// Staff moderation: report queue, decisions, appeals, evidence and legal disclosures.
// Principles: people decide (automation only holds content); every action is recorded and audited; reporters are hidden;
// nothing is reported to authorities automatically; appeals are decided by someone other than the original moderator.
import { randomUUID } from 'node:crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { bool, int, oneOf, str, validate } from '../lib/validate.js'
import { matches, paginate } from '../lib/list.js'
import { assertCanGrant, can, permissionsOf } from '../auth/access.js'
import { REPORT_REASONS } from './community.js'
import { logActivity } from '../lib/activity.js'

const DECISIONS = ['dismiss', 'warn', 'remove', 'restrict_content', 'restrict_user', 'suspend_user', 'escalate']
const NEEDS_ENFORCE = ['remove', 'restrict_content', 'restrict_user', 'suspend_user']
const reasonLabel = (r) => REPORT_REASONS[r]?.label ?? 'a policy violation'
const addDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString()

const contentOf = (d, r) => ({ post: d.posts, comment: d.comments, profile: d.users }[r.contentType] ?? []).find((x) => x.id === r.contentId)
const authorIdOf = (r, c) => (r.contentType === 'profile' ? c?.id : c?.authorId)
const textOf = (r, c) => (r.contentType === 'profile' ? c?.bio ?? '' : c?.content ?? '')
const userName = (d, id) => d.users.find((u) => u.id === id)?.name ?? 'Unknown'

function setContentStatus(r, c, status) {
  if (!c) return
  if (r.contentType === 'profile') { c.bioStatus = status; if (status === 'removed') c.bio = '' } else c.status = status
}

function notify(d, userId, message, actionId) {
  d.notices.push({ id: randomUUID(), userId, at: new Date().toISOString(), message, actionId: actionId ?? null, read: false })
  logActivity(d, userId, 'moderation_notice', null, { text: message }) // only the affected person ever sees this
}

const reportView = (d, r, actor) => {
  const c = contentOf(d, r)
  const authorId = authorIdOf(r, c)
  return {
    id: r.id, ref: r.ref, contentType: r.contentType, contentId: r.contentId, reason: r.reason, reasonLabel: reasonLabel(r.reason), severity: r.severity, status: r.status, source: r.source,
    createdAt: r.createdAt, escalated: !!r.escalated, flags: r.flags ?? [], preview: (textOf(r, c) || '(removed)').slice(0, 140), contentStatus: r.contentType === 'profile' ? c?.bioStatus : c?.status,
    author: authorId ? { id: authorId, name: userName(d, authorId) } : null,
    reportCount: d.reports.filter((x) => x.contentId === r.contentId).length,
    // The reporter is shown only to people who may view evidence.
    reporter: can(d, actor, 'moderation.evidence') && r.reporterId ? { id: r.reporterId, name: userName(d, r.reporterId) } : null,
  }
}

export function register(router, { store }) {
  router.get('/api/admin/moderation/summary', { perm: 'moderation.review' }, ({ user }) => {
    const d = store.read()
    return {
      openReports: d.reports.filter((r) => r.status === 'open').length, critical: d.reports.filter((r) => r.status === 'open' && r.severity === 'critical').length,
      openAppeals: can(d, user, 'moderation.appeals') ? d.appeals.filter((a) => a.status === 'open').length : null,
      escalated: can(d, user, 'moderation.evidence') ? d.reports.filter((r) => r.escalated && r.status === 'escalated').length : null,
    }
  })

  router.get('/api/admin/moderation/reports', { perm: 'moderation.review' }, ({ query, user }) => {
    const d = store.read()
    const from = query.from ? Date.parse(query.from) : null
    const to = query.to ? Date.parse(query.to) + 86_400_000 : null
    const rows = d.reports.filter((r) => (!query.status || r.status === query.status) && (!query.reason || r.reason === query.reason) && (!query.severity || r.severity === query.severity)
      && (!query.source || r.source === query.source) && (from ? Date.parse(r.createdAt) >= from : true) && (to ? Date.parse(r.createdAt) < to : true))
      .filter(matches(query, ['ref', 'reason', 'contentId']))
      .sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] - { critical: 0, high: 1, medium: 2, low: 3 }[b.severity]) || a.createdAt.localeCompare(b.createdAt))
    const page = paginate(rows, query)
    return { ...page, items: page.items.map((r) => reportView(d, r, user)), reasons: Object.entries(REPORT_REASONS).map(([id, v]) => ({ id, label: v.label })) }
  })

  router.get('/api/admin/moderation/reports/:id', { perm: 'moderation.review' }, ({ params, user }) => {
    const d = store.read()
    const r = d.reports.find((x) => x.id === params.id)
    if (!r) throw notFound('Report not found.')
    const c = contentOf(d, r)
    const authorId = authorIdOf(r, c)
    return {
      report: reportView(d, r, user), content: textOf(r, c), details: r.details,
      others: d.reports.filter((x) => x.contentId === r.contentId && x.id !== r.id).map((x) => ({ ref: x.ref, reasonLabel: reasonLabel(x.reason), status: x.status, source: x.source })),
      history: authorId ? d.actions.filter((a) => a.targetUserId === authorId).map((a) => ({ id: a.id, type: a.type, reason: a.policy, at: a.at, until: a.until ?? null, appealStatus: a.appealStatus, reversed: a.appealStatus === 'reversed' })) : [],
    }
  })

  router.post('/api/admin/moderation/reports/:id/decide', { perm: 'moderation.review' }, ({ params, body, user, auditIn }) => {
    const data = validate(body, { decision: oneOf(DECISIONS), reason: str({ min: 3, max: 500 }), userMessage: str({ max: 300, optional: true }), days: int({ min: 1, max: 365, optional: true }), permanent: bool({ optional: true }) })
    return store.transaction((d) => {
      if (NEEDS_ENFORCE.includes(data.decision) && !can(d, user, 'moderation.enforce')) throw forbidden()
      const r = d.reports.find((x) => x.id === params.id)
      if (!r) throw notFound('Report not found.')
      if (!['open', 'reviewing'].includes(r.status)) throw conflict('This report has already been decided.')
      const c = contentOf(d, r)
      const authorId = authorIdOf(r, c)
      const author = d.users.find((u) => u.id === authorId)
      if (authorId === user.id) throw forbidden('You cannot decide a report about your own content.')
      const userLevel = ['restrict_user', 'suspend_user'].includes(data.decision)
      if (userLevel) {
        if (!author) throw conflict('The author no longer exists.')
        assertCanGrant(d, user, [...permissionsOf(d, author)]) // you cannot sanction someone more powerful than you
        if (data.decision === 'restrict_user' && !data.days) throw badRequest('Choose how many days.', { days: 'Required.' })
        if (data.decision === 'suspend_user' && !data.permanent && !data.days) throw badRequest('Choose how many days, or permanent.', { days: 'Required.' })
      }
      const prior = d.actions.filter((a) => a.targetUserId === authorId && a.appealStatus !== 'reversed' && !['dismiss', 'escalate'].includes(a.type)).length
      const permanent = data.decision === 'suspend_user' && data.permanent === true
      if (permanent) {
        if (!can(d, user, 'users.suspend')) throw forbidden('Permanent suspension needs the "Suspend and reactivate users" permission.')
        // A report alone is never enough: there must be a history of violations or a critical-severity case.
        if (prior < 1 && r.severity !== 'critical') throw conflict('Permanent suspension needs prior violations or a critical case. Use a temporary suspension first.')
      }
      const now = new Date().toISOString()
      const action = { id: randomUUID(), caseRef: r.ref, type: data.decision, targetUserId: authorId ?? null, contentType: r.contentType, contentId: r.contentId, reason: data.reason, policy: r.reason, actorId: user.id, at: now, until: null, permanent, appealStatus: 'none', evidenceRef: null }
      const policyText = `(${reasonLabel(r.reason)})`
      const say = (m) => data.userMessage ? `${m} ${data.userMessage}` : m

      switch (data.decision) {
        case 'dismiss': setContentStatus(r, c, 'published'); break
        case 'warn': setContentStatus(r, c, 'published'); if (authorId) notify(d, authorId, say(`A moderator reviewed your content and asked you to follow the Community Guidelines ${policyText}.`), action.id); break
        case 'remove': setContentStatus(r, c, 'removed'); if (authorId) notify(d, authorId, say(`Your content was removed because it did not follow the Community Guidelines ${policyText}. You can appeal this decision.`), action.id); break
        case 'restrict_content': setContentStatus(r, c, 'restricted'); if (authorId) notify(d, authorId, say(`Your content was hidden because it did not follow the Community Guidelines ${policyText}. You can appeal this decision.`), action.id); break
        case 'restrict_user':
          setContentStatus(r, c, 'removed'); author.postingRestrictedUntil = addDays(data.days); action.until = author.postingRestrictedUntil
          notify(d, authorId, say(`Your content was removed and you cannot post until ${new Date(action.until).toDateString()} ${policyText}. You can appeal this decision.`), action.id); break
        case 'suspend_user':
          setContentStatus(r, c, 'removed'); d.sessions = d.sessions.filter((s) => s.userId !== authorId)
          if (permanent) { author.status = 'suspended'; author.suspendedReason = `Moderation ${r.ref}` } else { author.suspendedUntil = addDays(data.days); action.until = author.suspendedUntil }
          break // a suspended person cannot read notices; the sign-in message and appeal route explain it
        case 'escalate': {
          const ev = { id: randomUUID(), caseRef: r.ref, createdAt: now, createdBy: user.id, snapshot: { contentType: r.contentType, content: textOf(r, c), authorId: authorId ?? null, authorName: authorId ? userName(d, authorId) : null, flags: r.flags ?? [], reports: d.reports.filter((x) => x.contentId === r.contentId).map((x) => ({ ref: x.ref, reason: x.reason, details: x.details, reporterId: x.reporterId })) }, accessLog: [] }
          d.evidence.push(ev); action.evidenceRef = ev.id
          setContentStatus(r, c, 'restricted'); r.escalated = true
          break
        }
        default: break
      }
      d.actions.push(action)
      // Close this report and any others open on the same content.
      const closeAs = data.decision === 'escalate' ? 'escalated' : data.decision === 'dismiss' ? 'dismissed' : 'resolved'
      for (const x of d.reports.filter((y) => y.contentId === r.contentId && ['open', 'reviewing'].includes(y.status))) { x.status = closeAs; x.resolvedAt = now; x.decisionId = action.id }
      auditIn(d, `moderation.${data.decision}`, 'reports', r.id, { status: { from: 'open', to: closeAs }, reason: { from: null, to: data.reason }, ...(action.until ? { until: { from: null, to: action.until } } : {}) })
      return { ok: true, actionId: action.id, outcome: closeAs }
    })
  })

  /* ---------- appeals ---------- */
  router.get('/api/admin/moderation/appeals', { perm: 'moderation.appeals' }, ({ query }) => {
    const d = store.read()
    const rows = d.appeals.filter((a) => !query.status || a.status === query.status).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).filter(matches(query, ['ref', 'message']))
    const page = paginate(rows, query)
    return { ...page, items: page.items.map((a) => { const act = d.actions.find((x) => x.id === a.actionId); return { id: a.id, ref: a.ref, status: a.status, message: a.message, createdAt: a.createdAt, user: { id: a.userId, name: userName(d, a.userId) }, action: act && { type: act.type, caseRef: act.caseRef, reason: act.reason, policy: act.policy, by: userName(d, act.actorId) }, decidedAt: a.decidedAt ?? null, note: a.note ?? null } }) }
  })

  router.post('/api/admin/moderation/appeals/:id/decide', { perm: 'moderation.appeals' }, ({ params, body, user, auditIn }) => {
    const { outcome, note } = validate(body, { outcome: oneOf(['uphold', 'reverse']), note: str({ min: 3, max: 500 }) })
    return store.transaction((d) => {
      const a = d.appeals.find((x) => x.id === params.id)
      if (!a) throw notFound('Appeal not found.')
      if (a.status !== 'open') throw conflict('This appeal has already been decided.')
      const act = d.actions.find((x) => x.id === a.actionId)
      if (act.actorId === user.id) throw forbidden('A different reviewer must decide this appeal.')
      const target = d.users.find((u) => u.id === act.targetUserId)
      const row = act.contentType === 'post' ? d.posts.find((p) => p.id === act.contentId) : act.contentType === 'comment' ? d.comments.find((c) => c.id === act.contentId) : null
      const now = new Date().toISOString()
      if (outcome === 'reverse') {
        if (row) { row.status = 'published'; delete row.statusBeforeAppeal }
        if (act.contentType === 'profile' && target) target.bioStatus = 'published'
        if (target && act.type === 'restrict_user') delete target.postingRestrictedUntil
        if (target && act.type === 'suspend_user') { delete target.suspendedUntil; if (act.permanent && target.status === 'suspended') { target.status = 'active'; delete target.suspendedReason } }
        act.appealStatus = 'reversed'; act.reversedAt = now; act.reversedBy = user.id
        a.status = 'reversed'
        notify(d, target.id, 'Your appeal was successful and the decision has been reversed.')
      } else {
        if (row) { row.status = row.statusBeforeAppeal ?? 'removed'; delete row.statusBeforeAppeal }
        act.appealStatus = 'upheld'; a.status = 'upheld'
        notify(d, target.id, 'Your appeal was reviewed and the original decision stands.')
      }
      a.decidedAt = now; a.decidedBy = user.id; a.note = note
      auditIn(d, `appeal.${outcome === 'reverse' ? 'reversed' : 'upheld'}`, 'appeals', a.id, { status: { from: 'open', to: a.status } })
      return { ok: true, outcome: a.status }
    })
  })

  // Lift a restriction or suspension early (for example after review).
  router.post('/api/admin/moderation/users/:id/lift', { perm: 'moderation.enforce' }, ({ params, body, user, auditIn }) => {
    const { reason } = validate(body, { reason: str({ min: 3, max: 300 }) })
    return store.transaction((d) => {
      const u = d.users.find((x) => x.id === params.id)
      if (!u) throw notFound('User not found.')
      assertCanGrant(d, user, [...permissionsOf(d, u)])
      delete u.postingRestrictedUntil; delete u.suspendedUntil
      if (u.status === 'suspended' && String(u.suspendedReason ?? '').startsWith('Moderation')) { if (!can(d, user, 'users.suspend')) throw forbidden(); u.status = 'active'; delete u.suspendedReason }
      auditIn(d, 'moderation.lift', 'users', u.id, { reason: { from: null, to: reason } })
      return { ok: true }
    })
  })

  router.get('/api/admin/moderation/users/:id', { perm: 'moderation.review' }, ({ params }) => {
    const d = store.read()
    const u = d.users.find((x) => x.id === params.id)
    if (!u) throw notFound('User not found.')
    return {
      user: { id: u.id, name: u.name, status: u.status, postingRestrictedUntil: u.postingRestrictedUntil ?? null, suspendedUntil: u.suspendedUntil ?? null },
      history: d.actions.filter((a) => a.targetUserId === u.id).map((a) => ({ id: a.id, type: a.type, policy: a.policy, at: a.at, until: a.until, appealStatus: a.appealStatus })),
    }
  })

  /* ---------- escalated cases, evidence and legal disclosures (restricted) ---------- */
  router.get('/api/admin/moderation/cases', { perm: 'moderation.evidence' }, ({ query }) => {
    const d = store.read()
    const rows = d.reports.filter((r) => r.escalated).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = paginate(rows, query)
    return { ...page, items: page.items.map((r) => ({ ref: r.ref, reason: reasonLabel(r.reason), severity: r.severity, status: r.status, createdAt: r.createdAt, disclosures: d.disclosures.filter((x) => x.caseRef === r.ref).length })) }
  })

  router.get('/api/admin/moderation/cases/:ref', { perm: 'moderation.evidence' }, ({ params, user, auditIn }) => store.transaction((d) => {
    const ev = d.evidence.find((e) => e.caseRef === params.ref)
    if (!ev) throw notFound('No evidence is held for that case.')
    ev.accessLog.push({ by: user.id, byName: user.name, at: new Date().toISOString() }) // every look at evidence is recorded
    auditIn(d, 'evidence.view', 'evidence', ev.id)
    return { caseRef: ev.caseRef, createdAt: ev.createdAt, snapshot: ev.snapshot, accessLog: ev.accessLog, disclosures: d.disclosures.filter((x) => x.caseRef === params.ref) }
  }))

  // A record that information was shared with an authority. Recording it does NOT send anything anywhere.
  router.post('/api/admin/moderation/cases/:ref/disclosures', { perm: 'moderation.evidence' }, ({ params, body, user, auditIn }) => {
    const data = validate(body, { recipient: str({ min: 3, max: 160 }), basis: oneOf(['legal_request', 'emergency', 'legal_obligation']), summary: str({ min: 10, max: 800 }) })
    return store.transaction((d) => {
      if (!d.evidence.some((e) => e.caseRef === params.ref)) throw notFound('No evidence is held for that case.')
      const rec = { id: randomUUID(), caseRef: params.ref, ...data, by: user.id, byName: user.name, at: new Date().toISOString() }
      d.disclosures.push(rec)
      auditIn(d, 'disclosure.record', 'disclosures', rec.id, { basis: { from: null, to: data.basis }, recipient: { from: null, to: data.recipient } })
      return { status: 201, body: { disclosure: rec } }
    })
  })
}
