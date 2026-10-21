// A tiny JSON-file database. The whole API talks to it only through read() and transaction(), so swapping in a real
// database later means rewriting this one file.
//   transaction(fn): runs fn on a copy; if fn throws, nothing is saved. The file is written atomically.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const EMPTY = () => ({ users: [], roles: [], sessions: [], auditLogs: [], communities: [], cohorts: [], events: [], registrations: [], projects: [], enquiries: [], content: [], settings: {}, meta: {}, policyAcceptances: [], tokens: [], posts: [], comments: [], reports: [], actions: [], appeals: [], notices: [], evidence: [], disclosures: [], memberships: [], enrollments: [], activity: [] })

export function createStore(file) {
  let db = EMPTY()
  if (file && existsSync(file)) db = { ...EMPTY(), ...JSON.parse(readFileSync(file, 'utf8')) }
  const persist = (next) => {
    if (!file) return
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 })
    renameSync(tmp, file)
  }
  return {
    read: () => db,
    transaction(fn) {
      const draft = structuredClone(db)
      const result = fn(draft)
      persist(draft)
      db = draft
      return result
    },
  }
}
