// Session creation shared by member and admin sign-in. Only a SHA-256 of the token is stored.
import { randomUUID } from 'node:crypto'
import { randomToken, sha256 } from './crypto.js'

export const sessionCookie = (config, value, maxAgeSec) => `${config.cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${config.production ? '; Secure' : ''}`

export function startSession(db, user, config, ip) {
  const token = randomToken()
  const maxMs = config.sessionMaxHours * 3_600_000
  db.sessions = db.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now())
  db.sessions.push({ id: randomUUID(), userId: user.id, tokenHash: sha256(token), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + maxMs).toISOString(), ip })
  return { cookie: sessionCookie(config, token, Math.floor(maxMs / 1000)) }
}
