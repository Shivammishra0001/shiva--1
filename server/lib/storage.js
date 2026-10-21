// File storage for uploaded avatars. No cloud storage is configured, so files go to server/data/uploads (outside the web
// root, never served directly). To use S3 or similar, return an object with the same put/get/remove methods here.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const AVATAR_MAX_BYTES = 400 * 1024

// Identify the real file type from its first bytes, never from the name or the declared type. SVG is refused on purpose.
export function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: 'image/png', ext: 'png' }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' }
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' }
  return null
}

export function createStorage(config) {
  if (!config.dataFile) { // tests: keep files in memory
    const mem = new Map()
    return { put: (n, b) => mem.set(n, b), get: (n) => mem.get(n) ?? null, remove: (n) => mem.delete(n) }
  }
  const dir = join(dirname(config.dataFile), 'uploads', 'avatars')
  const safe = (name) => /^[a-f0-9-]{36}-[a-f0-9]{16}\.(png|jpg|webp)$/.test(name)
  return {
    put(name, buf) { if (!safe(name)) throw new Error('bad file name'); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, name), buf, { mode: 0o600 }) },
    get(name) { return safe(name) && existsSync(join(dir, name)) ? readFileSync(join(dir, name)) : null },
    remove(name) { if (safe(name)) rmSync(join(dir, name), { force: true }) },
  }
}
