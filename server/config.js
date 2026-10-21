// Server configuration. Values come from environment variables; `server/.env` (git-ignored) is loaded if present.
// Secrets are never hardcoded or logged.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const envFile = join(root, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d)

export const config = {
  production: process.env.NODE_ENV === 'production',
  port: num(process.env.API_PORT, 8787),
  dataFile: process.env.DATA_FILE || join(root, 'data', 'db.json'),
  // First Super Admin, created once when the database has no users.
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminName: process.env.ADMIN_NAME || 'Super Admin',
  sessionIdleMinutes: num(process.env.SESSION_IDLE_MINUTES, 120),
  sessionMaxHours: num(process.env.SESSION_MAX_HOURS, 12),
  loginMaxAttempts: num(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginIpMax: num(process.env.LOGIN_IP_MAX, 30),
  loginEmailMax: num(process.env.LOGIN_EMAIL_MAX, 100), // all addresses together, so one account cannot be locked out by a few guesses
  loginWindowMinutes: num(process.env.LOGIN_WINDOW_MINUTES, 15),
  // Set TRUST_PROXY=true only when the API runs behind a reverse proxy you control (it then reads X-Forwarded-For).
  trustProxy: process.env.TRUST_PROXY === 'true',
  // Email verification is enforced only when a mail provider can deliver the link. Off by default (no provider yet).
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  // Development only: write verification / reset links to server/data/dev-outbox.jsonl so the flows can be tried locally.
  devOutbox: process.env.DEV_OUTBOX === 'true' && process.env.NODE_ENV !== 'production',
  reportThreshold: num(process.env.REPORT_THRESHOLD, 3), // distinct reporters that hold a post for review
  reportRetentionDays: num(process.env.REPORT_RETENTION_DAYS, 365),
  cookieName: 'dscw_admin',
}
