// Enquiries from the public forms: review, assign, update status, add internal notes.
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, Empty, ErrorState, Field, Filters, Loading, Modal, PageHead, Pagination, Table, fmtDate, label, useList, useToast } from '../ui'

const NEXT = { new: ['in_progress', 'closed'], in_progress: ['resolved', 'new', 'closed'], resolved: ['in_progress', 'closed'], closed: [] }

function Detail({ enquiry, staff, onClose, onChanged }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const [e, setE] = useState(enquiry)
  const [note, setNote] = useState('')
  const manage = can('enquiries.manage')
  const act = async (fn, msg) => { try { const r = await fn(); setE(r.item); toast(msg); onChanged() } catch (err) { toast(err.message, 'bad') } }
  const people = staff.length ? staff : [{ id: user.id, name: `${user.name} (me)` }]
  return (
    <Modal open onClose={onClose} wide title={`${label(e.type)}: ${e.name}`}>
      <dl className="a-facts"><div><dt>From</dt><dd>{e.name} · {e.email}</dd></div><div><dt>Received</dt><dd>{fmtDate(e.createdAt)}</dd></div><div><dt>Status</dt><dd><Badge value={e.status} /></dd></div></dl>
      <p className="a-quote">{e.message}</p>
      {manage && <div className="a-actions a-actions--wrap">
        {NEXT[e.status].map((s) => <Button key={s} onClick={() => act(() => api(`/enquiries/${e.id}/status`, { method: 'POST', body: { status: s } }), `Marked ${label(s)}`)}>{label(s)}</Button>)}
        <label className="a-inline">Assigned to <select className="a-input" value={e.assigneeId ?? ''} onChange={(ev) => act(() => api(`/enquiries/${e.id}/assign`, { method: 'POST', body: { assigneeId: ev.target.value || null } }), 'Assignment updated')}><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      </div>}
      <h3>Internal notes</h3>
      {(e.notes ?? []).length ? e.notes.map((n, i) => <p key={i} className="a-note"><b>{n.byName}</b> · <span className="a-muted">{fmtDate(n.at)}</span><br />{n.note}</p>) : <p className="a-muted">No notes yet.</p>}
      {manage && <div className="a-inlineform"><Field label="Add a note">{(id) => <input id={id} className="a-input" value={note} onChange={(ev) => setNote(ev.target.value)} />}</Field><Button disabled={note.trim().length < 2} onClick={() => act(async () => { const r = await api(`/enquiries/${e.id}/notes`, { method: 'POST', body: { note } }); setNote(''); return r }, 'Note added')}>Add</Button></div>}
    </Modal>
  )
}

export default function Enquiries() {
  const { can } = useAuth()
  const [f, setF] = useState({ q: '', status: '', type: '', page: 1 })
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }))
  const { data, loading, error, reload } = useList('/enquiries', f)
  const staffQ = useList('/users', { status: 'active', pageSize: 100 }, can('users.read'))
  const [open, setOpen] = useState(null)
  return (
    <>
      <PageHead title="Enquiries" sub="Messages and requests sent through the public forms." />
      <Filters>
        <input className="a-input" type="search" aria-label="Search enquiries" placeholder="Search" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <select className="a-input" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All statuses</option>{(data?.statuses ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <select className="a-input" aria-label="Type" value={f.type} onChange={(e) => set({ type: e.target.value })}><option value="">All types</option>{(data?.types ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
      </Filters>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <><Table rows={data.items} onRow={setOpen} empty={<Empty title="No enquiries" body="Enquiries sent through the API appear here. The public Contact and Booking forms currently open WhatsApp instead, so they do not create enquiries yet." />} columns={[
          { key: 'n', title: 'From', render: (e) => <b>{e.name}</b> }, { key: 't', title: 'Type', render: (e) => label(e.type) }, { key: 'm', title: 'Message', render: (e) => `${e.message.slice(0, 70)}${e.message.length > 70 ? '…' : ''}` },
          { key: 's', title: 'Status', render: (e) => <Badge value={e.status} /> }, { key: 'd', title: 'Received', render: (e) => fmtDate(e.createdAt) }]} />
          <Pagination data={data} onPage={(page) => setF((x) => ({ ...x, page }))} /></>)}
      {open && <Detail enquiry={open} staff={staffQ.data?.items ?? []} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  )
}
