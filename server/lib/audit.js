// Append-only audit trail. There is no update or delete path for auditLogs in the API.
import { randomUUID } from 'node:crypto'

const SENSITIVE = /password|token|secret|hash|cookie/i

// Keep only changed fields and never copy anything that looks like a secret.
export function diff(before = {}, after = {}) {
  const changes = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (SENSITIVE.test(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = { from: before[key] ?? null, to: after[key] ?? null }
  }
  return changes
}

export function writeAudit(db, { actor, action, resource, resourceId, outcome = 'success', changes, requestId, ip }) {
  db.auditLogs.push({
    id: randomUUID(), at: new Date().toISOString(),
    actorId: actor?.id ?? null, actorEmail: actor?.email ?? null,
    action, resource, resourceId: resourceId ?? null, outcome,
    changes: changes && Object.keys(changes).length ? changes : undefined, requestId, ip,
  })
}
