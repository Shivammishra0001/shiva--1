// Test harness: a fresh in-memory app on an ephemeral port, with a helper client that keeps cookies.
import { createServer } from 'node:http'
import { createApp } from '../app.js'
import { createStore } from '../lib/store.js'
import { config as base } from '../config.js'

export const ADMIN = { email: 'root@example.test', password: 'Sup3rSecretPass' }
const PASSWORD = 'Str0ngPassword1'

export async function startApp(overrides = {}, extra = {}) {
  const config = { ...base, dataFile: null, adminEmail: ADMIN.email, adminPassword: ADMIN.password, loginMaxAttempts: 5, loginIpMax: 10_000, registerMax: 10_000, forgotMax: 10_000, contentMax: 10_000, ...overrides }
  const app = createApp({ config, store: createStore(null), log: (m) => { if (process.env.SHOW_ERR) console.error(String(m).split('\n').slice(0, 4).join('\n')) }, ...extra })
  const server = createServer(app.handler)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`

  const client = (cookie = '') => {
    const c = {
      cookie,
      async req(method, path, body, headers = {}) {
        const res = await fetch(url + path, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'dscw-admin', ...(c.cookie ? { cookie: c.cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
        const text = await res.text()
        let json = null
        try { json = JSON.parse(text) } catch { /* csv or empty */ }
        return { status: res.status, body: json, text, headers: res.headers }
      },
      get: (p, h) => c.req('GET', p, undefined, h), post: (p, b, h) => c.req('POST', p, b ?? {}, h), patch: (p, b) => c.req('PATCH', p, b), put: (p, b) => c.req('PUT', p, b), del: (p, b) => c.req('DELETE', p, b ?? {}),
      async login(email, password, path = '/api/admin/auth/login') {
        const r = await c.req('POST', path, { email, password }, path.startsWith('/api/auth') ? { 'x-requested-with': 'dscw-web' } : {})
        const set = r.headers.get('set-cookie')
        if (set) c.cookie = set.split(';')[0]
        return r
      },
    }
    return c
  }

  const admin = client()
  await admin.login(ADMIN.email, ADMIN.password)

  // Create a user with the given role keys and return a signed-in client for them.
  async function userWith(roleKeys, name = 'Test User') {
    const roles = (await admin.get('/api/admin/roles')).body.items
    const roleIds = roleKeys.map((k) => roles.find((r) => r.key === k).id)
    const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${Math.random().toString(36).slice(2, 7)}@example.test`
    const created = await admin.post('/api/admin/users', { name, email, roleIds })
    const c = client()
    // Temporary passwords must be changed first; do that to get a normal session.
    await c.login(email, created.body.temporaryPassword)
    await c.post('/api/admin/auth/change-password', { currentPassword: created.body.temporaryPassword, newPassword: PASSWORD })
    return { c, email, id: created.body.user.id }
  }

  return { app, url, admin, client, userWith, store: app.store, close: () => new Promise((r) => server.close(r)) }
}

export const future = (days) => new Date(Date.now() + days * 86_400_000).toISOString()
