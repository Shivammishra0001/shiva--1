// Local-only community "backend": a tiny store, an async API, hooks, a query-string
// router and small utilities. Everything is saved in this browser (localStorage).
// Replace the functions in `api` with real network calls when a backend exists.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { communities, cohorts, memberById, members, seedCommentsFor, seedPostsFor, seedProjectsFor } from '../data/communities'
import { events as eventRecords } from '../data/events'
import { getStatusLabel, isPast, isUpcoming } from '../utils/eventHelpers'

const KEY = 'dscw.community.v1'
const blank = { user: null, joined: [], following: [], reactions: {}, saved: {}, rsvp: {}, votes: {}, posts: [], comments: [], registrations: {} }
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
  const all = [...state.posts.filter((p) => p.communityId === c.id), ...seed.posts.filter((p) => p.communityId === c.id)]
  all.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  return all.map(decoratePost)
}

// Sample posts across communities, newest first (used by the "Ideas become projects" section).
const listActivity = () => communities.flatMap((c) => listPosts(c.slug).map((p) => ({ ...p, community: c })))
  .filter((p) => ['project', 'announcement', 'question'].includes(p.type) && !p.pinned)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3)

function listComments(postId) {
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
  const base = c?.sample ? members.map((m) => ({ ...m })) : []
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
  async join(id) { await wait(); if (!state.joined.includes(id)) patch({ joined: [...state.joined, id] }) },
  async leave(id) { await wait(250); patch({ joined: state.joined.filter((x) => x !== id) }) },
  follow(id) { if (!state.following.includes(id)) patch({ following: [...state.following, id] }) },
  unfollow(id) { patch({ following: state.following.filter((x) => x !== id) }) },
  setReaction(postId, on) { patch({ reactions: { ...state.reactions, [postId]: on } }) },
  setSaved(postId, on) { patch({ saved: { ...state.saved, [postId]: on } }) },
  // No server yet: a registration is saved in this browser only. The UI says so.
  async registerForEvent(eventId, { name, email, note }) {
    await wait(450)
    patch({ registrations: { ...state.registrations, [eventId]: { name: name.trim(), email: email.trim(), note: note?.trim() ?? '', at: new Date().toISOString() } } })
  },
  cancelRegistration(eventId) { const r = { ...state.registrations }; delete r[eventId]; patch({ registrations: r }) },
  votePoll: async (postId, optionId) => { await wait(250); patch({ votes: { ...state.votes, [postId]: optionId } }) },
  async addComment(postId, { content, parentCommentId }) {
    await wait(250)
    patch({ comments: [...state.comments, { id: `l-${Date.now()}`, postId, authorId: 'me', content: content.trim(), createdAt: new Date().toISOString(), parentId: parentCommentId }] })
  },
  async createPost(slug, { content, images, link, poll, projectId }) {
    await wait(300)
    const c = bySlug[slug]
    const project = projectId ? seed.projects.find((p) => p.id === projectId) : null
    let linkObj = null
    if (link) { try { const u = new URL(link); linkObj = { url: link, domain: u.hostname.replace(/^www\./, ''), title: u.hostname.replace(/^www\./, ''), description: '' } } catch { throw new Error('That link doesn’t look valid.') } }
    const post = {
      id: `l-${Date.now()}`, communityId: c.id, authorId: 'me', likes: 0, createdAt: new Date().toISOString(), content: content.trim(), tags: [],
      type: poll ? 'poll' : project ? 'project' : undefined,
      images: images?.length ? images.map((src, i) => ({ src, alt: `Image ${i + 1} attached by ${state.user.name}` })) : undefined,
      link: linkObj ?? undefined,
      project: project ? { name: project.name, stage: project.stage, description: project.description, tech: project.tech } : undefined,
      poll: poll ? { options: poll.map((label, i) => ({ id: `o${i}`, label, votes: 0 })) } : undefined,
    }
    patch({ posts: [post, ...state.posts] })
  },
}

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
    try { await api.join(community.id) } finally { setPending(null) }
    action?.(state.user)
  }
  return {
    user: state.user,
    joined,
    pending,
    label: community.name,
    join: (action) => (state.user ? doJoin(action) : requestSignIn(() => doJoin(action))),
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
export const useCommunityPosts = (slug) => useQuery(`posts:${slug}`, () => listPosts(slug))
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
