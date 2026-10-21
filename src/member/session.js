// Member session for the public site. One small store; every page that needs to know who is signed in uses useMember().
// The server is the source of truth (HttpOnly cookie). This file only caches /api/auth/me for display.
import { useEffect, useSyncExternalStore } from 'react'

export class MemberError extends Error {
  constructor(status, body) { super(body?.error?.message || 'Something went wrong. Try again.'); this.status = status; this.code = body?.error?.code; this.details = body?.error?.details || {} }
}

export async function mfetch(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'dscw-web', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  } catch { throw new MemberError(0, { error: { message: 'Cannot reach the server. Check your connection and try again.', code: 'network' } }) }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new MemberError(res.status, json)
  return json
}

let state = { status: 'loading', user: null, versions: null, verificationRequired: false }
let started = false
const subs = new Set()
const set = (next) => { state = { ...state, ...next }; subs.forEach((f) => f()) }

export async function loadMe() {
  try { const r = await mfetch('/api/auth/me'); set({ status: 'ready', user: r.user ?? null, versions: r.versions, verificationRequired: r.verificationRequired }) } catch { set({ status: 'ready', user: null }) }
}
export const useMember = () => {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state, () => state)
  useEffect(() => { if (!started) { started = true; loadMe() } }, [])
  return s
}
export async function signOut() { try { await mfetch('/api/auth/logout', { method: 'POST' }) } finally { set({ user: null }); window.location.assign('/') } }

// Only same-site pages are allowed as a post-login destination (blocks open redirects).
const ALLOWED = ['/', '/index.html', '/profile.html', '/community.html', '/cohort.html', '/market.html', '/about.html', '/contact.html', '/legal.html']
export function safeNext(next, fallback = '/community.html') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\u0000-\u001f]/.test(next)) return fallback
  try {
    const u = new URL(next, window.location.origin)
    if (u.origin !== window.location.origin || !ALLOWED.includes(u.pathname)) return fallback
    return u.pathname + u.search + u.hash
  } catch { return fallback }
}

export const passwordChecks = (pw) => [
  { id: 'len', ok: pw.length >= 12, text: 'At least 12 characters' },
  { id: 'case', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), text: 'Upper and lower case letters' },
  { id: 'num', ok: /\d/.test(pw), text: 'A number' },
]
export const normalisePhone = (v) => String(v ?? '').replace(/[\s\-().]/g, '')
export const phoneOk = (v) => /^\+[1-9]\d{7,14}$/.test(normalisePhone(v))
export const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
