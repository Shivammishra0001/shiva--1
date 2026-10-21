// Read-only audit trail. Nothing on this page can change a record.
import { useState } from 'react'
import { Badge, Empty, ErrorState, Filters, Loading, PageHead, Pagination, fmtDate, label, useList } from '../ui'

export default function AuditLogs() {
  const [f, setF] = useState({ q: '', action: '', outcome: '', from: '', to: '', page: 1 })
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }))
  const { data, loading, error, reload } = useList('/audit', f)
  return (
    <>
      <PageHead title="Audit log" sub="An append-only record of sensitive administrative actions. Secrets are never stored here." />
      <Filters>
        <input className="a-input" type="search" aria-label="Search" placeholder="Search actor, action or id" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <input className="a-input" aria-label="Action prefix" placeholder="Action, e.g. user." value={f.action} onChange={(e) => set({ action: e.target.value })} />
        <select className="a-input" aria-label="Outcome" value={f.outcome} onChange={(e) => set({ outcome: e.target.value })}><option value="">Any outcome</option><option value="success">Success</option><option value="failed">Failed</option><option value="denied">Denied</option></select>
        <label className="a-inline">From <input className="a-input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="a-inline">To <input className="a-input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
      </Filters>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : !data.items.length ? <Empty title="No matching records" /> : (
        <><ul className="a-audit">{data.items.map((a) => (
          <li key={a.id}><div><b>{label(a.action)}</b> <Badge value={a.outcome} /><p className="a-muted">{a.actorEmail ?? 'system'} · {a.resource}{a.resourceId ? ` · ${String(a.resourceId).slice(0, 8)}` : ''} · {fmtDate(a.at)}</p>
            {a.changes && <details><summary>Changes</summary><ul className="a-diff">{Object.entries(a.changes).map(([k, v]) => <li key={k}><code>{k}</code>: <del>{JSON.stringify(v.from)}</del> → <ins>{JSON.stringify(v.to)}</ins></li>)}</ul></details>}</div></li>))}</ul>
          <Pagination data={data} onPage={(page) => setF((x) => ({ ...x, page }))} /></>)}
    </>
  )
}
