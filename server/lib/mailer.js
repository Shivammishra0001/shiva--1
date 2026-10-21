// Outgoing messages (verification and password reset links). No mail provider is connected, so by default nothing is sent.
// In development (DEV_OUTBOX=true) links are written to server/data/dev-outbox.jsonl so the flows can be tried locally.
// To go live, return a provider-backed object with the same `send` shape here. Tokens are never logged to the console.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function createMailer(config) {
  const file = join(dirname(config.dataFile || 'server/data/db.json'), 'dev-outbox.jsonl')
  return {
    async send({ to, type, link }) {
      if (!config.devOutbox) return { delivered: false }
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), to, type, link })}\n`, { mode: 0o600 })
      return { delivered: false, devOutbox: true } // written locally, not delivered to a real inbox
    },
  }
}
