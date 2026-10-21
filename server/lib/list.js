// Shared helpers for paginated, filtered list endpoints (always server-side).
export function paginate(items, query, { defaultSize = 20, maxSize = 100 } = {}) {
  const size = Math.min(maxSize, Math.max(1, Number.parseInt(query.pageSize, 10) || defaultSize))
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const total = items.length
  return { items: items.slice((page - 1) * size, page * size), page, pageSize: size, total, pages: Math.max(1, Math.ceil(total / size)) }
}

export const matches = (query, fields) => {
  const q = String(query.q || '').trim().toLowerCase()
  return q ? (row) => fields.some((f) => String(row[f] ?? '').toLowerCase().includes(q)) : () => true
}

export function sortBy(items, query, allowed, fallback) {
  const key = allowed.includes(query.sort) ? query.sort : fallback
  const dir = query.dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0))
}
