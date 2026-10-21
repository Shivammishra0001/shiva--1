// Password hashing (scrypt), random tokens and constant-time comparison. Built-in modules only.
import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEYLEN = 64
const COST = 16384

export const MIN_PASSWORD = 12

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEYLEN, { N: COST })
  return `scrypt$${COST}$${salt.toString('base64')}$${key.toString('base64')}`
}

// Used only when seeding the first admin at start-up.
export function hashPasswordSync(password) {
  const salt = randomBytes(16)
  return `scrypt$${COST}$${salt.toString('base64')}$${scryptSync(password, salt, KEYLEN, { N: COST }).toString('base64')}`
}

export async function verifyPassword(password, stored) {
  const [alg, cost, salt, hash] = String(stored || '').split('$')
  if (alg !== 'scrypt') return false
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), KEYLEN, { N: Number(cost) })
  const expected = Buffer.from(hash, 'base64')
  return key.length === expected.length && timingSafeEqual(key, expected)
}

// Run a hash even when the account does not exist, so response time does not reveal valid emails.
const DUMMY = await hashPassword('dummy-password-for-timing')
export const burnPasswordCheck = (password) => verifyPassword(password, DUMMY)

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const sha256 = (v) => createHash('sha256').update(v).digest('hex')

export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return 'Use upper and lower case letters and a number.'
  return null
}

// A random one-time password that satisfies the policy (used for admin-initiated resets).
export function temporaryPassword() {
  const body = randomBytes(12).toString('base64url')
  return `Tp${body}9a`
}
