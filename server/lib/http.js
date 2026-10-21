// Minimal HTTP layer: router, JSON body parsing, security headers, error handling and request ids.
import { randomUUID } from 'node:crypto'
import { HttpError } from './errors.js'

const MAX_BODY = 1_000_000

export function createRouter() {
  const routes = []
  const add = (method) => (path, options, handler) => {
    if (typeof options === 'function') { handler = options; options = {} }
    const keys = []
    const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' })}/?$`)
    routes.push({ method, re, keys, ...options, handler })
  }
  return {
    get: add('GET'), post: add('POST'), patch: add('PATCH'), put: add('PUT'), delete: add('DELETE'),
    match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue
        const m = r.re.exec(pathname)
        if (m) {
          try { return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) } } catch { return null } // malformed %-escape: treat as not found
        }
      }
      return null
    },
    hasPath: (pathname) => routes.some((r) => r.re.test(pathname)),
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) { reject(new HttpError(413, 'too_large', 'Request is too large.')); req.destroy() } else chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new HttpError(400, 'bad_json', 'Send valid JSON.')) }
    })
    req.on('error', reject)
  })
}

export function send(res, status, payload, headers = {}) {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    ...headers,
  })
  res.end(body)
}

export function sendText(res, status, text, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers })
  res.end(text)
}

export const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((p) => p.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]))

// Build the request handler. `context(req, route)` supplies auth info; `log` receives one line per server error.
export function createHandler({ router, context, log = console.error }) {
  return async function handler(req, res) {
    const requestId = randomUUID()
    const url = new URL(req.url, 'http://localhost')
    try {
      const hit = router.match(req.method, url.pathname)
      if (!hit) return send(res, router.hasPath(url.pathname) ? 405 : 404, { error: { code: 'not_found', message: 'Not found.', requestId } })
      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {}
      const ctx = await context({ req, res, url, route: hit.route, params: hit.params, body, requestId })
      const result = await hit.route.handler(ctx)
      if (res.writableEnded) return undefined
      if (result && result.__raw) return sendText(res, result.status || 200, result.text, result.headers)
      if (result && result.__buffer) { res.writeHead(200, { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", ...result.headers }); return res.end(result.__buffer) }
      return send(res, result?.status || 200, result?.body ?? result ?? {}, { 'X-Request-Id': requestId, ...(result?.headers || {}) })
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details, requestId } }, { 'X-Request-Id': requestId, ...(err.headers || {}) })
      log(`[${requestId}] ${err?.stack || err}`) // stack stays on the server
      return send(res, 500, { error: { code: 'server_error', message: 'Something went wrong. Try again.', requestId } }, { 'X-Request-Id': requestId })
    }
  }
}
