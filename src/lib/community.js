// Local-only community "backend": a tiny store, an async API, hooks, a query-string
// router and small utilities. Everything is saved in this browser (localStorage).
// Replace the functions in `api` with real network calls when a backend exists.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { communities, cohorts, memberById, members, seedCommentsFor, seedPostsFor, seedProjectsFor } from '../data/communities'
import { events as eventRecords } from '../data/events'
import { getStatusLabel, isPast, isUpcoming } from '../utils/eventHelpers'

const KEY = 'dscw.community.v1'
const blank = { user: null, joined: [], enrolled: [], following: [], reactions: {}, saved: {}, rsvp: {}, votes: {}, posts: [], comments: [], registrations: {} }
const load = () => {
  try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...blank } }
}

let state = load()
let version = 0
const subs = new Set()
const emit = () => {
  version += 1
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full or blocked: keep working in memory */ }
  subs.forEach((f) => f())
}
const patch = (p) => { state = { ...state, ...p }; emit() }
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
// Follows made in another tab of this browser show up here straight away.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); version += 1; subs.forEach((f) => f()) } })
}
const useVersion = () => useSyncExternalStore(subscribe, () => version, () => 0)
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))

// ---------- member content from the server ----------
// Posts and comments written by signed-in members live on the server (screened before publishing, reportable, moderated).
// The sample posts below stay in the browser and are labelled as samples.
const remote = { posts: {} } // space slug -> posts as the API returns them
const bump = () => { version += 1; subs.forEach((f) => f()) }

export class ServerError extends Error {
  constructor(status, body) { super(body?.error?.message || 'Something went wrong. Try again.'); this.status = status; this.code = body?.error?.code }
}
export async function serverCall(method, path, body) {
  let res
  try {
    res = await fetch(path, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'dscw-web', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  } catch { throw new ServerError(0, { error: { message: 'Cannot reach the server. Check your connection and try again.' } }) }
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) window.location.assign(`/signin.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  if (!res.ok) throw new ServerError(res.status, json)
  return json
}
// Copy the signed-in person's real memberships, enrolments and registrations into the local view.
export async function syncMine() {
  try {
    const r = await serverCall('GET', '/api/me/participation')
    const regs = Object.fromEntries(r.events.filter((e) => e.slug && e.status === 'registered').map((e) => [e.slug, { name: '', email: '', note: '', at: e.registeredAt }]))
    patch({ joined: r.communities.map((c) => c.slug), enrolled: r.cohorts.filter((c) => c.status === 'enrolled').map((c) => c.slug), registrations: regs })
  } catch { /* keep what we have */ }
}
export const useEnrollment = (cohort) => {
  useVersion()
  const [pending, setPending] = useState(false)
  const enrolled = state.enrolled.includes(cohort.slug)
  return { enrolled, pending, toggle: async () => { setPending(true); try { await (enrolled ? api.withdraw(cohort.slug) : api.enroll(cohort.slug)) } finally { setPending(false) } } }
}

export async function refreshServerPosts(slug) {
  try { remote.posts[slug] = (await serverCall('GET', `/api/community/${slug}/posts`)).items; bump() } catch { /* shown as sample posts only */ }
}
const serverPostsFor = (slug) => (remote.posts[slug] ?? []).map((sp) => ({
  id: sp.id, communityId: bySlug[slug]?.id, authorId: sp.author.id, content: sp.content, createdAt: sp.createdAt, likes: 0, tags: [],
  link: sp.link ? { url: sp.link, domain: new URL(sp.link).hostname.replace(/^www\./, ''), title: new URL(sp.link).hostname.replace(/^www\./, ''), description: '' } : undefined,
  __server: true, __slug: slug, __author: { id: sp.author.id, name: sp.author.name, role: sp.mine ? 'You' : 'Member', accent: '#f6dbc0' }, __mine: sp.mine, __status: sp.status, __comments: sp.comments,
}))
const findServerPost = (id) => Object.values(remote.posts).flat().find((p) => p.id === id)

// ---------- seed (built once) ----------
const everyone = [...communities, ...cohorts]
const bySlug = Object.fromEntries(everyone.map((c) => [c.slug, c]))
const seed = {
  posts: everyone.flatMap(seedPostsFor),
  comments: everyone.flatMap(seedCommentsFor),
  projects: everyone.flatMap(seedProjectsFor),
}
// base path of the page that is open (community.html or cohort.html), so links stay on the same page
export const pageBase = () => (typeof window !== 'undefined' && window.location.pathname.includes('cohort') ? '/cohort.html' : '/community.html')
export const getCommunity = (slug) => bySlug[slug]
export const getEventBySlug = (slug) => decoratedEvents().find((e) => e.slug === slug)
export const communityName = (slug) => bySlug[slug]?.name

const author = (id) => (id === 'me' ? { ...state.user, id: 'me' } : memberById(id)) ?? { id, name: 'Member', role: '' }

// ---------- reads ----------
function listCommunities({ q = '', category = 'All', sort = 'default' }) {
  const needle = q.trim().toLowerCase()
  const list = communities
    .map((c) => ({ ...c, followers: c.followers + (state.following.includes(c.id) ? 1 : 0), upcomingCount: eventsFor(c).filter((e) => e.upcoming).length }))
    .filter((c) => (category === 'All' || c.group === category) &&
      (!needle || [c.name, c.tagline, c.about, ...c.keywords, ...c.topics].join(' ').toLowerCase().includes(needle)))
  const by = { members: (a, b) => b.followers - a.followers, name: (a, b) => a.name.localeCompare(b.name) }
  return by[sort] ? list.sort(by[sort]) : list
}

const commentCount = (postId) => seed.comments.filter((c) => c.postId === postId).length + state.comments.filter((c) => c.postId === postId).length

function decoratePost(p) {
  if (p.__server) return { ...p, author: p.__author, sample: false, mine: p.__mine, serverStatus: p.__status, liked: !!state.reactions[p.id], likes: p.likes + (state.reactions[p.id] ? 1 : 0), saved: !!state.saved[p.id], commentsCount: p.__comments.length, poll: undefined }
  const liked = !!state.reactions[p.id]
  const myVote = state.votes[p.id] ?? null
  const poll = p.poll && {
    options: p.poll.options.map((o) => ({ ...o, votes: o.votes + (myVote === o.id ? 1 : 0) })),
    total: p.poll.options.reduce((s, o) => s + o.votes, 0) + (myVote ? 1 : 0),
    myVote,
  }
  return { ...p, author: author(p.authorId), sample: !String(p.id).startsWith('l-'), liked, likes: p.likes + (liked ? 1 : 0), saved: !!state.saved[p.id], commentsCount: commentCount(p.id), poll }
}

function listPosts(slug) {
  const c = bySlug[slug]
  if (!c) return []
  const all = [...serverPostsFor(slug), ...state.posts.filter((p) => p.communityId === c.id), ...seed.posts.filter((p) => p.communityId === c.id)]
  all.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  return all.map(decoratePost)
}

// Sample posts across communities, newest first (used by the "Ideas become projects" section).
const listActivity = () => communities.flatMap((c) => listPosts(c.slug).map((p) => ({ ...p, community: c })))
  .filter((p) => ['project', 'announcement', 'question'].includes(p.type) && !p.pinned)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3)

function listComments(postId) {
  if (String(postId).startsWith('sp-')) {
    const sp = findServerPost(postId)
    const all = (sp?.comments ?? []).map((c) => ({ id: c.id, postId, authorId: c.author.id, content: c.content, createdAt: c.createdAt, parentId: c.parentId, author: { id: c.author.id, name: c.author.name, role: c.mine ? 'You' : '', accent: '#f6dbc0' }, serverStatus: c.status, mine: c.mine, __server: true }))
    return all.filter((c) => !c.parentId).map((t) => ({ ...t, replies: all.filter((r) => r.parentId === t.id) }))
  }
  const all = [...seed.comments, ...state.comments].filter((c) => c.postId === postId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((c) => ({ ...c, author: author(c.authorId) }))
  const tops = all.filter((c) => !c.parentId)
  return tops.map((t) => ({ ...t, replies: all.filter((r) => r.parentId === t.id) }))
}

// Events come from the existing events data. They are matched to communities by keywords.
// Nothing here is verified; the UI labels the whole schedule as sample content.
const text = (e) => `${e.title} ${e.topics.join(' ')} ${e.shortDescription}`.toLowerCase()
const decorateEvent = (e) => ({
  ...e,
  upcoming: isUpcoming(e) && new Date(e.startDateTime) > new Date(),
  past: isPast(e),
  statusLabel: getStatusLabel(e.status).replace('Registration Open', 'Registration open').replace('Registration Closed', 'Registration closed'),
  open: e.status === 'registration_open' && (!e.registrationDeadline || new Date(e.registrationDeadline) > new Date()),
  registration: state.registrations[e.id] ?? null,
  communities: communities.filter((c) => c.keywords.some((k) => text(e).includes(k))).map((c) => c.slug),
  cohorts: cohorts.filter((c) => c.keywords.some((k) => text(e).includes(k))).map((c) => c.slug),
})
const decoratedEvents = () => eventRecords.map(decorateEvent)
const eventsFor = (c) => decoratedEvents().filter((e) => (c.cohort ? e.cohorts : e.communities).includes(c.slug))
const listEvents = (slug) => eventsFor(bySlug[slug]).sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
const listAllEvents = () => decoratedEvents().sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
const listProjects = (slug) => seed.projects.filter((p) => p.communityId === bySlug[slug]?.id).map((p) => ({ ...p, builder: author(p.builder) }))
const listMembers = (slug) => {
  const c = bySlug[slug]
  const base = members.map((m) => ({ ...m })) // demo profiles, labelled in the UI
  return state.user && state.joined.includes(c?.id) ? [{ ...state.user, isLocal: true, projectsCount: 0 }, ...base] : base
}

// ---------- writes ----------
export const api = {
  async signIn({ name, role }) {
    await wait(300)
    const user = { id: 'me', name: name.trim(), role: role?.trim() || 'Community member', accent: '#f6dbc0' }
    patch({ user })
    return user
  },
  signOut() { patch({ user: null }) },
  // Memberships, enrolments and event registrations are records on the server; the browser copy below only mirrors them.
  async join(id) { await serverCall('POST', `/api/community/${id}/membership`); if (!state.joined.includes(id)) patch({ joined: [...state.joined, id] }) },
  async leave(id) { await serverCall('DELETE', `/api/community/${id}/membership`); patch({ joined: state.joined.filter((x) => x !== id) }) },
  async enroll(slug) { await serverCall('POST', `/api/cohorts/${slug}/enrollment`); if (!state.enrolled.includes(slug)) patch({ enrolled: [...state.enrolled, slug] }) },
  async withdraw(slug) { await serverCall('DELETE', `/api/cohorts/${slug}/enrollment`); patch({ enrolled: state.enrolled.filter((x) => x !== slug) }) },
  follow(id) { if (!state.following.includes(id)) patch({ following: [...state.following, id] }) },
  unfollow(id) { patch({ following: state.following.filter((x) => x !== id) }) },
  setReaction(postId, on) { patch({ reactions: { ...state.reactions, [postId]: on } }) },
  setSaved(postId, on) { patch({ saved: { ...state.saved, [postId]: on } }) },
  // The server takes your name and email from your account. It enforces capacity, deadlines and duplicates.
  async registerForEvent(eventId, { note }) { await serverCall('POST', `/api/community/events/${eventId}/register`, { note: note?.trim() || undefined }); await syncMine() },
  async cancelRegistration(eventId) { await serverCall('DELETE', `/api/community/events/${eventId}/register`); await syncMine() },
  votePoll: async (postId, optionId) => { await wait(250); patch({ votes: { ...state.votes, [postId]: optionId } }) },
  // Comments and posts go to the server, which screens them before they appear. Returns { held, message }.
  async addComment(postId, { content, parentCommentId }) {
    const sp = findServerPost(postId)
    if (!sp) throw new Error('Comments are only available on member posts.')
    const slug = Object.keys(remote.posts).find((k) => remote.posts[k].some((p) => p.id === postId))
    const r = await serverCall('POST', `/api/community/posts/${postId}/comments`, { content: content.trim(), parentId: parentCommentId ?? undefined })
    await refreshServerPosts(slug)
    return r
  },
  async createPost(slug, { content, link }) {
    const r = await serverCall('POST', `/api/community/${slug}/posts`, { content: content.trim(), link: link || undefined })
    await refreshServerPosts(slug)
    return r
  },
  async report({ contentType, contentId, reason, details }) {
    return serverCall('POST', '/api/community/reports', { contentType, contentId, reason, details: details || undefined })
  },
}

// ---------- welcome popup shown after a successful join ----------
let welcomed = null // { community, name }
const welcomeSubs = new Set()
export const showWelcome = (community, name) => { welcomed = { community, name }; welcomeSubs.forEach((f) => f()) }
export const closeWelcome = () => { welcomed = null; welcomeSubs.forEach((f) => f()) }
export const useWelcome = () => useSyncExternalStore((f) => { welcomeSubs.add(f); return () => welcomeSubs.delete(f) }, () => welcomed, () => null)

// ---------- house-rules agreement shown before a join completes ----------
let agreement = null // { community, then }
const agreeSubs = new Set()
export const requestAgreement = (community, then) => { agreement = { community, then }; agreeSubs.forEach((f) => f()) }
export const closeAgreement = () => { agreement = null; agreeSubs.forEach((f) => f()) }
export const useAgreement = () => useSyncExternalStore((f) => { agreeSubs.add(f); return () => agreeSubs.delete(f) }, () => agreement, () => null)

// ---------- auth + join flow ----------
let authPrompt = null // { then }
const authSubs = new Set()
export const requestSignIn = (then) => { authPrompt = { then }; authSubs.forEach((f) => f()) }
export const closeSignIn = () => { authPrompt = null; authSubs.forEach((f) => f()) }
export const useAuthPrompt = () => useSyncExternalStore((f) => { authSubs.add(f); return () => authSubs.delete(f) }, () => authPrompt, () => null)
export const useAuth = () => { useVersion(); return { user: state.user } }
// Follower count = demo baseline + this browser's own follow. Updates live, including across tabs.
export function useFollow(community) {
  useVersion()
  const following = state.following.includes(community.id)
  return { following, count: community.followers + (following ? 1 : 0), toggle: () => (following ? api.unfollow(community.id) : api.follow(community.id)) }
}
export const useJoinedCommunityIds = () => { useVersion(); return state.joined }

export function useJoinFlow(community) {
  useVersion()
  const [pending, setPending] = useState(null)
  const joined = state.joined.includes(community.id)
  const doJoin = async (action) => {
    setPending('join')
    try { await api.join(community.id) } catch (e) { toast(e.message, { tone: 'error' }); setPending(null); return } finally { setPending(null) }
    showWelcome(community, state.user?.name)
    action?.(state.user)
  }
  return {
    user: state.user,
    joined,
    pending,
    label: community.name,
    join: (action) => { const ask = () => requestAgreement(community, () => doJoin(action)); return state.user ? ask() : requestSignIn(ask) },
    leave: async () => { setPending('leave'); try { await api.leave(community.id) } finally { setPending(null) } },
  }
}

// ---------- data hooks ----------
const seen = new Set()
export function useQuery(key, fn, { enabled = true } = {}) {
  const v = useVersion()
  const [readyKey, setReadyKey] = useState(null)
  useEffect(() => {
    if (!enabled || seen.has(key)) return undefined
    const t = setTimeout(() => { seen.add(key); setReadyKey(key) }, 260)
    return () => clearTimeout(t)
  }, [key, enabled])
  const ready = enabled && (seen.has(key) || readyKey === key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => (ready ? fn() : undefined), [ready, key, v])
  return { data, loading: enabled && !ready }
}
export const useCommunities = (opts) => useQuery(`dir:${opts.q}|${opts.category}|${opts.sort}`, () => listCommunities(opts))
export function useCommunityPosts(slug) {
  useEffect(() => { refreshServerPosts(slug) }, [slug])
  return useQuery(`posts:${slug}`, () => listPosts(slug))
}
export const useComments = (postId, enabled) => useQuery(`comments:${postId}`, () => listComments(postId), { enabled })
export const useProjects = (slug, enabled = true) => useQuery(`projects:${slug}`, () => listProjects(slug), { enabled })
export const useEvents = (slug) => useQuery(`events:${slug}`, () => listEvents(slug))
export const useAllEvents = () => useQuery('events:all', listAllEvents)
export const useRecentActivity = () => useQuery('activity', listActivity)
export const useMembers = (slug) => useQuery(`members:${slug}`, () => listMembers(slug))

// ---------- query-string router (no extra dependency) ----------
export const navigate = (url, { replace = false } = {}) => {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
  window.dispatchEvent(new Event('cm:nav'))
  if (!replace) window.scrollTo({ top: 0 })
}
const subNav = (f) => { window.addEventListener('popstate', f); window.addEventListener('cm:nav', f); return () => { window.removeEventListener('popstate', f); window.removeEventListener('cm:nav', f) } }
export const useParams = () => new URLSearchParams(useSyncExternalStore(subNav, () => window.location.search, () => ''))
export const setParams = (params, next, opts) => {
  const p = new URLSearchParams(params)
  Object.entries(next).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
  const s = p.toString()
  navigate(`${window.location.pathname}${s ? `?${s}` : ''}`, opts)
}

// ---------- toasts ----------
let toasts = []
const toastSubs = new Set()
export const toast = (message, { tone = 'success' } = {}) => {
  const t = { id: Math.random(), message, tone }
  toasts = [...toasts, t]
  toastSubs.forEach((f) => f())
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); toastSubs.forEach((f) => f()) }, 3500)
}
export const useToasts = () => useSyncExternalStore((f) => { toastSubs.add(f); return () => toastSubs.delete(f) }, () => toasts, () => [])

// ---------- time ----------
export const timeAgo = (iso) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m`
  const h = Math.round(m / 60); if (h < 24) return `${h}h`
  const d = Math.round(h / 24); return d < 30 ? `${d}d` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
export const fullDate = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const eventDay = (iso) => { const d = new Date(iso); return { month: d.toLocaleDateString('en-IN', { month: 'short' }), day: d.getDate() } }
export const num = (n) => n.toLocaleString('en-IN')
export const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))
export const timeOf = (iso, tz = 'Asia/Kolkata') => new Date(iso).toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
export const dateOf = (iso, tz = 'Asia/Kolkata') => new Date(iso).toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
