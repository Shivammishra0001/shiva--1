// In-memory sliding-window limiter, used for sign-in and public form endpoints.
import { tooMany } from './errors.js'

export function createLimiter({ max, windowMs }) {
  const hits = new Map()
  const prune = (key, now) => {
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs)
    hits.set(key, list)
    return list
  }
  return {
    // Throws when the key is over its limit.
    hit(key, now = Date.now()) {
      const list = prune(key, now)
      if (list.length >= max) {
        const wait = Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000))
        throw tooMany(`Too many attempts. Try again in ${wait >= 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`}.`, wait)
      }
      list.push(now)
    },
    count: (key, now = Date.now()) => prune(key, now).length,
    reset: (key) => hits.delete(key),
    // Clear every key matching a test (used to lift a lock after a password change or reset).
    resetWhere(test) { for (const k of [...hits.keys()]) if (test(k)) hits.delete(k) },
  }
}
