// The only place the admin UI talks to the server. Every call sends the session cookie and the CSRF header.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Something went wrong. Try again.')
    this.status = status
    this.code = body?.error?.code
    this.details = body?.error?.details || {}
  }
}

const listeners = new Set()
export const onSessionExpired = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/admin${path}`, {
      method, credentials: 'same-origin',
      headers: { 'X-Requested-With': 'dscw-admin', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, { error: { message: 'Cannot reach the server. Check your connection and try again.', code: 'network' } })
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) listeners.forEach((f) => f())
  return res
}

export async function api(path, options) {
  const res = await request(path, options)
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new ApiError(res.status, json)
  return json
}

// Download a server-generated file (CSV export) through the authenticated API.
export async function download(path, filename) {
  const res = await request(path)
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export const qs = (params) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}
