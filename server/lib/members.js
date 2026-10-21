// Helpers for member accounts: policy acceptance, suspension/restriction windows and the safe public view of a user.
import { POLICY_IDS, POLICIES } from '../policies.js'
import { permissionsOf, rolesOf } from '../auth/access.js'

const future = (iso) => !!iso && Date.parse(iso) > Date.now()
export const isTempSuspended = (u) => future(u.suspendedUntil)
export const isPostingRestricted = (u) => future(u.postingRestrictedUntil)

// Policies whose current version the user has not accepted yet.
export function pendingPolicies(db, user) {
  return POLICY_IDS.filter((id) => !db.policyAcceptances.some((a) => a.userId === user.id && a.policyId === id && a.version === POLICIES[id].version))
    .map((id) => ({ id, title: POLICIES[id].title, version: POLICIES[id].version }))
}

export function recordAcceptance(db, user, ids = POLICY_IDS, now = new Date().toISOString()) {
  for (const id of ids) {
    db.policyAcceptances.push({ id: crypto.randomUUID(), userId: user.id, policyId: id, version: POLICIES[id].version, acceptedAt: now, status: 'accepted' })
  }
}

// What the browser gets about the signed-in user. Never includes hashes, tokens or other people's data.
export const DEFAULT_SETTINGS = { visibility: 'members', showInterests: false, showCommunities: false, showEmail: false, showLocation: false, notifyEmail: true, notifyEvents: true }
export const settingsOf = (u) => ({ ...DEFAULT_SETTINGS, ...(u.settings ?? {}) })
export const avatarUrl = (u) => (u.avatar ? `/api/members/${u.id}/avatar?v=${u.avatar.hash}` : null)

export function memberView(db, u) {
  const open = db.notices.filter((n) => n.userId === u.id && !n.read)
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone ?? null, bio: u.bio ?? '', bioStatus: u.bioStatus ?? 'published',
    username: u.username ?? '', headline: u.headline ?? '', location: u.location ?? '', interests: u.interests ?? [], skills: u.skills ?? [], links: u.links ?? [],
    avatarUrl: avatarUrl(u), settings: settingsOf(u),
    emailVerified: !!u.emailVerified, status: u.status, createdAt: u.createdAt,
    roles: rolesOf(db, u).map((r) => ({ key: r.key, name: r.name })), isStaff: permissionsOf(db, u).size > 0,
    pendingPolicies: pendingPolicies(db, u), postingRestrictedUntil: isPostingRestricted(u) ? u.postingRestrictedUntil : null,
    notices: open.map((n) => ({ id: n.id, at: n.at, message: n.message, actionId: n.actionId ?? null, appealable: !!n.actionId })),
  }
}
