// Retention: resolved reports older than the retention period are anonymised (reporter and free text removed).
// Content snapshots held for an escalated case are kept until a person releases them.
export function applyRetention(store, config, now = Date.now()) {
  const cutoff = now - config.reportRetentionDays * 86_400_000
  const old = store.read().reports.filter((r) => ['resolved', 'dismissed'].includes(r.status) && !r.escalated && Date.parse(r.resolvedAt ?? r.createdAt) < cutoff && (r.reporterId || r.details))
  if (!old.length) return 0
  store.transaction((d) => { for (const r of d.reports) if (old.some((o) => o.id === r.id)) { r.reporterId = null; r.details = ''; r.anonymised = true } })
  return old.length
}
