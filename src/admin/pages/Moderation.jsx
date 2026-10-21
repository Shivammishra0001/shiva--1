// Moderation: report queue, appeals and escalated cases. Every decision asks for a reason and a confirmation, and the
// server records and audits it. Reporter names are hidden unless you hold the evidence permission.
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, Confirm, Empty, ErrorState, Field, Filters, Loading, Modal, PageHead, Pagination, Table, fmtDate, label, useList, useToast } from '../ui'

const DECISION_TEXT = {
  dismiss: ['Dismiss (no violation)', 'Content stays or returns to published. Use for false positives.'],
  warn: ['Warn the author', 'Content stays up. The author is sent a notice.'],
  remove: ['Remove content', 'Content is removed. The author is notified and can appeal.'],
  restrict_content: ['Hide content', 'Content is hidden pending the author’s appeal. The author is notified.'],
  restrict_user: ['Restrict posting (temporary)', 'Removes this content and stops the author posting for a number of days.'],
  suspend_user: ['Suspend account', 'Removes this content and signs the author out. Temporary, or permanent for repeated or critical cases.'],
  escalate: ['Escalate for authorised review', 'Preserves a restricted copy as evidence and hides the content. Nothing is sent to anyone automatically.'],
}

function ReportDialog({ id, onClose, onDone }) {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error } = useList(`/moderation/reports/${id}`)
  const [form, setForm] = useState({ decision: 'dismiss', reason: '', userMessage: '', days: '', permanent: false })
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState({})
  const allowed = Object.keys(DECISION_TEXT).filter((d) => !['remove', 'restrict_content', 'restrict_user', 'suspend_user'].includes(d) || can('moderation.enforce'))
  const r = data?.report
  const needsDays = form.decision === 'restrict_user' || (form.decision === 'suspend_user' && !form.permanent)
  const apply = async () => {
    await api(`/moderation/reports/${id}/decide`, { method: 'POST', body: { decision: form.decision, reason: form.reason, userMessage: form.userMessage || undefined, days: needsDays ? Number(form.days) : undefined, permanent: form.decision === 'suspend_user' ? form.permanent : undefined } })
    toast('Decision recorded'); onDone()
  }
  return (
    <Modal open onClose={onClose} wide title={r ? `${r.ref} · ${r.reasonLabel}` : 'Report'}>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} /> : (
        <>
          <p><Badge value={r.status} /> <Badge value={r.severity} /> <Badge value={r.source}>{r.source === 'system' ? 'Automatic check' : 'Member report'}</Badge> {r.escalated && <Badge value="escalated">Escalated</Badge>}</p>
          <dl className="a-facts"><div><dt>Author</dt><dd>{r.author?.name ?? '-'}</dd></div><div><dt>Content</dt><dd>{r.contentType} · <Badge value={r.contentStatus ?? 'removed'} /></dd></div><div><dt>Reports on this content</dt><dd>{r.reportCount}</dd></div><div><dt>Reporter</dt><dd>{r.reporter?.name ?? <span className="a-muted">Hidden</span>}</dd></div></dl>
          <h3>Content (reported)</h3><p className="a-quote">{data.content || '(removed)'}</p>
          {data.details && <><h3>Reporter note</h3><p className="a-quote">{data.details}</p></>}
          {r.flags.length > 0 && <><h3>Automatic checks</h3><ul className="a-list">{r.flags.map((f) => <li key={f.rule}><span>{f.detail}</span><Badge value={f.severity === 'severe' ? 'critical' : 'medium'}>{f.rule}</Badge></li>)}</ul><p className="a-hint">Automatic checks only hold content for a person. They can be wrong, so read the content in context.</p></>}
          {data.history.length > 0 && <><h3>Author history</h3><ul className="a-list">{data.history.map((h) => <li key={h.id}><span>{label(h.type)} · {label(h.reason)}{h.reversed && ' (reversed)'}</span><span className="a-muted">{fmtDate(h.at)}</span></li>)}</ul></>}
          {['open', 'reviewing'].includes(r.status) ? (
            <section className="a-card"><h2>Decision</h2>
              <Field label="Action">{(fid) => <select id={fid} className="a-input" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>{allowed.map((d) => <option key={d} value={d}>{DECISION_TEXT[d][0]}</option>)}</select>}</Field>
              <p className="a-muted">{DECISION_TEXT[form.decision][1]}</p>
              {needsDays && <Field label="Days" error={err.days}>{(fid) => <input id={fid} className="a-input" type="number" min="1" max="365" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />}</Field>}
              {form.decision === 'suspend_user' && can('users.suspend') && <label className="a-switch"><input type="checkbox" checked={form.permanent} onChange={(e) => setForm({ ...form, permanent: e.target.checked })} /><span>Permanent (needs prior violations or a critical case)</span></label>}
              <Field label="Reason (internal, recorded in the audit log)">{(fid) => <textarea id={fid} className="a-input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />}</Field>
              {['warn', 'remove', 'restrict_content', 'restrict_user'].includes(form.decision) && <Field label="Message to the author (optional)" hint="Shown to the author. Do not include reporter details.">{(fid) => <input id={fid} className="a-input" value={form.userMessage} onChange={(e) => setForm({ ...form, userMessage: e.target.value })} />}</Field>}
              <Button variant={['suspend_user', 'remove'].includes(form.decision) ? 'danger' : 'primary'} disabled={form.reason.trim().length < 3 || (needsDays && !form.days)} onClick={() => { setErr({}); setConfirm(true) }}>Apply decision</Button>
            </section>
          ) : <p className="a-note">This report was {r.status}. Open the appeals tab if the author appealed.</p>}
          <Confirm open={confirm} onClose={() => setConfirm(false)} title={`${DECISION_TEXT[form.decision][0]}?`} body={`${DECISION_TEXT[form.decision][1]} This is recorded and can be appealed.`} confirmLabel="Confirm decision" danger={['suspend_user', 'remove'].includes(form.decision)} onConfirm={apply} />
        </>
      )}
    </Modal>
  )
}

function Queue() {
  const [f, setF] = useState({ status: 'open', reason: '', severity: '', source: '', q: '', from: '', to: '', page: 1 })
  const set = (p) => setF((x) => ({ ...x, page: 1, ...p }))
  const { data, loading, error, reload } = useList('/moderation/reports', f)
  const [open, setOpen] = useState(null)
  return (
    <>
      <Filters>
        <input className="a-input" type="search" aria-label="Search by reference" placeholder="Search reference" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <select className="a-input" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">Any status</option>{['open', 'resolved', 'dismissed', 'escalated'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <select className="a-input" aria-label="Reason" value={f.reason} onChange={(e) => set({ reason: e.target.value })}><option value="">Any reason</option>{(data?.reasons ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <select className="a-input" aria-label="Severity" value={f.severity} onChange={(e) => set({ severity: e.target.value })}><option value="">Any severity</option>{['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <select className="a-input" aria-label="Source" value={f.source} onChange={(e) => set({ source: e.target.value })}><option value="">Any source</option><option value="member">Member reports</option><option value="system">Automatic checks</option></select>
        <label className="a-inline">From <input className="a-input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="a-inline">To <input className="a-input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
      </Filters>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <><Table rows={data.items} onRow={(r) => setOpen(r.id)} empty={<Empty title="The queue is clear" body="New reports and automatic holds appear here, most severe first." />} columns={[
          { key: 'ref', title: 'Reference', render: (r) => <b>{r.ref}</b> }, { key: 'p', title: 'Content', render: (r) => r.preview }, { key: 'r', title: 'Reason', render: (r) => r.reasonLabel },
          { key: 'sev', title: 'Severity', render: (r) => <Badge value={r.severity} /> }, { key: 'src', title: 'Source', render: (r) => <Badge value={r.source}>{r.source === 'system' ? 'Auto' : 'Member'}</Badge> },
          { key: 'n', title: 'Reports', render: (r) => r.reportCount }, { key: 's', title: 'Status', render: (r) => <Badge value={r.status} /> }, { key: 'd', title: 'Received', render: (r) => fmtDate(r.createdAt) }]} />
          <Pagination data={data} onPage={(page) => setF((x) => ({ ...x, page }))} /></>)}
      {open && <ReportDialog id={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload() }} />}
    </>
  )
}

function Appeals() {
  const toast = useToast()
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useList('/moderation/appeals', { status, page })
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(null)
  return (
    <>
      <Filters><select className="a-input" aria-label="Appeal status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All</option><option value="open">Open</option><option value="reversed">Reversed</option><option value="upheld">Upheld</option></select></Filters>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <><Table rows={data.items} onRow={(a) => { setOpen(a); setNote('') }} empty={<Empty title="No appeals" />} columns={[
          { key: 'r', title: 'Reference', render: (a) => <b>{a.ref}</b> }, { key: 'u', title: 'Member', render: (a) => a.user.name }, { key: 'a', title: 'Decision appealed', render: (a) => label(a.action?.type) },
          { key: 's', title: 'Status', render: (a) => <Badge value={a.status} /> }, { key: 'd', title: 'Received', render: (a) => fmtDate(a.createdAt) }]} />
          <Pagination data={data} onPage={setPage} /></>)}
      {open && (
        <Modal open onClose={() => setOpen(null)} title={`Appeal ${open.ref}`}>
          <dl className="a-facts"><div><dt>Member</dt><dd>{open.user.name}</dd></div><div><dt>Original decision</dt><dd>{label(open.action?.type)} · {label(open.action?.policy)}</dd></div><div><dt>Decided by</dt><dd>{open.action?.by}</dd></div><div><dt>Case</dt><dd>{open.action?.caseRef}</dd></div></dl>
          <h3>Member’s message</h3><p className="a-quote">{open.message}</p>
          {open.status === 'open' ? (
            <><Field label="Your note (recorded)">{(id) => <textarea id={id} className="a-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              <p className="a-hint">You cannot decide an appeal against your own decision.</p>
              <div className="a-actions"><Button variant="primary" disabled={note.trim().length < 3} onClick={() => setPending('reverse')}>Reverse the decision</Button><Button disabled={note.trim().length < 3} onClick={() => setPending('uphold')}>Uphold the decision</Button></div></>
          ) : <p className="a-note">Decided: {label(open.status)}. {open.note}</p>}
          <Confirm open={!!pending} onClose={() => setPending(null)} title={pending === 'reverse' ? 'Reverse this decision?' : 'Uphold this decision?'} body={pending === 'reverse' ? 'Content is restored and any restriction or suspension from this decision is lifted. The member is told.' : 'The original decision stands and the member is told.'} confirmLabel={pending === 'reverse' ? 'Reverse' : 'Uphold'}
            onConfirm={async () => { await api(`/moderation/appeals/${open.id}/decide`, { method: 'POST', body: { outcome: pending, note } }); toast('Appeal decided'); setOpen(null); reload() }} />
        </Modal>)}
    </>
  )
}

function Cases() {
  const toast = useToast()
  const { data, loading, error, reload } = useList('/moderation/cases')
  const [ref, setRef] = useState(null)
  const detail = useList(`/moderation/cases/${ref}`, {}, !!ref)
  const [d, setD] = useState({ recipient: '', basis: 'legal_request', summary: '' })
  const [err, setErr] = useState('')
  const record = async () => {
    setErr('')
    try { await api(`/moderation/cases/${ref}/disclosures`, { method: 'POST', body: d }); toast('Disclosure recorded. Nothing was sent: this is the record only.'); setD({ recipient: '', basis: 'legal_request', summary: '' }); detail.reload(); reload() } catch (e) { setErr(e.message) }
  }
  return (
    <>
      <p className="a-note">Escalated cases hold a restricted copy of the evidence. Every view is logged. Disclosures are recorded here, but sharing anything with an authority is a human decision made under your legal process. Nothing is reported automatically.</p>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <Table rows={data.items.map((c) => ({ ...c, id: c.ref }))} onRow={(c) => setRef(c.ref)} empty={<Empty title="No escalated cases" />} columns={[
          { key: 'r', title: 'Case', render: (c) => <b>{c.ref}</b> }, { key: 'a', title: 'Reason', render: (c) => c.reason }, { key: 's', title: 'Severity', render: (c) => <Badge value={c.severity} /> }, { key: 'dis', title: 'Disclosures', render: (c) => c.disclosures }, { key: 'd', title: 'Opened', render: (c) => fmtDate(c.createdAt) }]} />)}
      {ref && (
        <Modal open onClose={() => setRef(null)} wide title={`Evidence ${ref}`}>
          {detail.loading && !detail.data ? <Loading /> : detail.error ? <ErrorState error={detail.error} /> : (
            <>
              <h3>Preserved content</h3><p className="a-quote">{detail.data.snapshot.content}</p>
              <dl className="a-facts"><div><dt>Author</dt><dd>{detail.data.snapshot.authorName}</dd></div><div><dt>Reports</dt><dd>{detail.data.snapshot.reports.length}</dd></div><div><dt>Preserved</dt><dd>{fmtDate(detail.data.createdAt)}</dd></div></dl>
              <h3>Who has viewed this evidence</h3><ul className="a-list">{detail.data.accessLog.map((a, i) => <li key={i}><span>{a.byName}</span><span className="a-muted">{fmtDate(a.at)}</span></li>)}</ul>
              <h3>Disclosure record</h3>
              {detail.data.disclosures.length ? <ul className="a-list">{detail.data.disclosures.map((x) => <li key={x.id}><span>{x.recipient} · {label(x.basis)}<small className="a-muted"> · {x.summary}</small></span><span className="a-muted">{fmtDate(x.at)}</span></li>)}</ul> : <p className="a-muted">None recorded.</p>}
              <section className="a-card"><h2>Record a disclosure</h2>
                <Field label="Recipient (who received it)">{(id) => <input id={id} className="a-input" value={d.recipient} onChange={(e) => setD({ ...d, recipient: e.target.value })} />}</Field>
                <Field label="Legal basis">{(id) => <select id={id} className="a-input" value={d.basis} onChange={(e) => setD({ ...d, basis: e.target.value })}><option value="legal_request">Valid legal request</option><option value="emergency">Emergency (imminent danger)</option><option value="legal_obligation">Legal reporting obligation</option></select>}</Field>
                <Field label="What was shared">{(id) => <textarea id={id} className="a-input" rows={2} value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />}</Field>
                {err && <p className="a-error" role="alert">{err}</p>}
                <Button variant="primary" disabled={d.recipient.length < 3 || d.summary.length < 10} onClick={record}>Record disclosure</Button></section>
            </>)}
        </Modal>)}
    </>
  )
}

export default function Moderation() {
  const { can } = useAuth()
  const summary = useList('/moderation/summary')
  const tabs = [['queue', 'Queue'], ...(can('moderation.appeals') ? [['appeals', 'Appeals']] : []), ...(can('moderation.evidence') ? [['cases', 'Escalated cases']] : [])]
  const [tab, setTab] = useState('queue')
  const s = summary.data
  return (
    <>
      <PageHead title="Moderation" sub="Review reports, decide, and handle appeals. People decide; automatic checks only hold content for review." />
      {s && <div className="a-stats"><div className="a-stat"><p>Open reports</p><strong>{s.openReports}</strong><small className="a-muted">{s.critical} critical</small></div>{s.openAppeals !== null && <div className="a-stat"><p>Open appeals</p><strong>{s.openAppeals}</strong></div>}{s.escalated !== null && <div className="a-stat"><p>Escalated cases</p><strong>{s.escalated}</strong></div>}</div>}
      <div className="a-filters" role="tablist" aria-label="Moderation sections">{tabs.map(([id, name]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`a-btn${tab === id ? ' a-btn--primary' : ''}`} onClick={() => setTab(id)}>{name}</button>)}</div>
      {tab === 'queue' && <Queue />}{tab === 'appeals' && <Appeals />}{tab === 'cases' && <Cases />}
    </>
  )
}
