// Access rules in one place: who can do what, privilege-escalation limits and last-Super-Admin protection.
import { ALL_PERMISSIONS } from './permissions.js'
import { forbidden, conflict } from '../lib/errors.js'

export const SUPER = 'super_admin'

export const rolesOf = (db, user) => user.roleIds.map((id) => db.roles.find((r) => r.id === id)).filter(Boolean)
export const permissionsOf = (db, user) => new Set(rolesOf(db, user).flatMap((r) => r.permissions))
export const isSuperAdmin = (db, user) => rolesOf(db, user).some((r) => r.key === SUPER)
export const can = (db, user, permission) => user.status === 'active' && permissionsOf(db, user).has(permission)
export const requirePermission = (db, user, permission) => { if (!can(db, user, permission)) throw forbidden() }

// Escalation rule: you may only hand out permissions that you hold yourself.
export function assertCanGrant(db, actor, permissions) {
  const mine = permissionsOf(db, actor)
  const missing = permissions.filter((p) => !mine.has(p))
  if (missing.length) throw forbidden(`You cannot grant permissions you do not have: ${missing.join(', ')}.`)
}

// You may assign or change a role only if it grants nothing beyond your own permissions.
export function assertCanAssignRoles(db, actor, roleIds) {
  for (const id of roleIds) {
    const role = db.roles.find((r) => r.id === id)
    if (!role) throw conflict('Unknown role.')
    assertCanGrant(db, actor, role.permissions)
  }
}

// Only a Super Admin may change a Super Admin's account.
export function assertCanManageUser(db, actor, target) {
  if (isSuperAdmin(db, target) && !isSuperAdmin(db, actor)) throw forbidden('Only a Super Admin can change a Super Admin account.')
}

const activeSupers = (db) => db.users.filter((u) => u.status === 'active' && isSuperAdmin(db, u))

// Call before suspending, deleting or demoting `target`: at least one other active Super Admin must remain.
export function assertNotLastSuperAdmin(db, target) {
  if (!isSuperAdmin(db, target) || target.status !== 'active') return
  if (activeSupers(db).filter((u) => u.id !== target.id).length === 0) throw conflict('This is the last active Super Admin. Add another Super Admin first.')
}

export const validPermissions = (list) => list.every((p) => ALL_PERMISSIONS.includes(p))
