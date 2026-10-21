// Communities, cohorts, events and projects. One generic page (ResourcePage) driven by a field list, plus small
// extras: event registrations and project publishing/notes. To add a field, add it to the `fields` array below
// (and to the server schema in server/modules/<name>.js).
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, Empty, ErrorState, Field, Filters, Loading, Modal, PageHead, Pagination, Table, fmtDate, label, useList, useToast } from '../ui'

/* ---------- field <-> payload helpers ---------- */
const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const toForm = (item, fields) => Object.fromEntries(fields.map((f) => {
  const v = item?.[f.name]
  if (f.type === 'datetime') return [f.name, toLocal(v)]
  if (f.type === 'lines') return [f.name, (v ?? []).join('\n')]
  if (f.type === 'people') return [f.name, (v ?? []).map((p) => (p.role ? `${p.name} | ${p.role}` : p.name)).join('\n')]
  return [f.name, v ?? f.default ?? '']
}))
const lines = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean)
const toPayload = (form, fields) => Object.fromEntries(fields.map((f) => {
  const v = form[f.name]
  if (f.type === 'datetime') return [f.name, v ? new Date(v).toISOString() : undefined]
  if (f.type === 'lines') return [f.name, lines(v)]
  if (f.type === 'people') return [f.name, lines(v).map((l) => { const [name, role] = l.split('|').map((x) => x.trim()); return role ? { name, role } : { name } })]
  if (f.type === 'number') return [f.name, v === '' ? null : Number(v)]
  return [f.name, v === '' ? undefined : v]
}))

function FieldInput({ f, value, onChange, id }) {
  const common = { id, className: 'a-input', value, onChange: (e) => onChange(e.target.value) }
  if (f.type === 'textarea') return <textarea {...common} rows={4} />
  if (f.type === 'lines' || f.type === 'people') return <textarea {...common} rows={4} placeholder={f.type === 'people' ? 'Name | Role (one per line)' : 'One per line'} />
  if (f.type === 'select') return <select {...common}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  if (f.type === 'datetime') return <input {...common} type="datetime-local" />
  if (f.type === 'number') return <input {...common} type="number" min="1" />
  return <input {...common} type="text" />
}

/* ---------- status change ---------- */
function Transition({ base, item, to, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needs = to === 'cancelled' || to === 'market_ready'
  const run = async () => {
    setBusy(true); setError('')
    try { onDone(await api(`${base}/${item.id}/transition`, { method: 'POST', body: { to, reason: reason.trim() || undefined } })) } catch (e) { setError(e.details?.reason || e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Move to ${label(to)}?`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={to === 'cancelled' ? 'danger' : 'primary'} busy={busy} onClick={run}>{label(to)}</Button></>}>
      <p className="a-muted">{to === 'cancelled' ? 'Cancelled events stop accepting registrations. Existing registrations are kept.' : to === 'market_ready' ? 'Market Ready tells the public a project is available. Write how you verified it.' : `This changes the status to ${label(to)}.`}</p>
      <Field label={needs ? 'Reason or evidence (required)' : 'Note (optional)'} error={error}>{(id) => <textarea id={id} className="a-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
    </Modal>
  )
}

/* ---------- event registrations ---------- */
function Registrations({ event, onClose }) {
  const { can } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useList(`/events/${event.id}/registrations`, { q, page })
  const [form, setForm] = useState({ name: '', email: '' })
  const [err, setErr] = useState({})
  const add = async () => {
    setErr({})
    try { await api(`/events/${event.id}/registrations`, { method: 'POST', body: form }); setForm({ name: '', email: '' }); toast('Registration added'); reload() } catch (e) { setErr({ ...e.details, form: e.message }) }
  }
  const setStatus = async (r, status) => { try { await api(`/events/${event.id}/registrations/${r.id}`, { method: 'PATCH', body: { status } }); reload() } catch (e) { toast(e.message, 'bad') } }
  const s = data?.stats
  return (
    <Modal open onClose={onClose} wide title={`Registrations: ${event.title}`}>
      {s && <p className="a-muted"><b>{s.registered}</b> registered{s.capacity ? ` of ${s.capacity} seats (${s.remaining} left)` : ''} · {s.attended} attended · {s.cancelled} cancelled</p>}
      <input className="a-input" type="search" aria-label="Search registrations" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <><Table rows={data.items} empty={<Empty title="No registrations yet" />} columns={[
          { key: 'n', title: 'Name', render: (r) => r.name }, { key: 'e', title: 'Email', render: (r) => r.email }, { key: 's', title: 'Status', render: (r) => <Badge value={r.status} /> },
          { key: 'a', title: 'Actions', render: (r) => can('registrations.manage') ? <span className="a-actions">
            {r.status === 'registered' && <Button onClick={() => setStatus(r, 'attended')}>Attended</Button>}{r.status === 'registered' && <Button onClick={() => setStatus(r, 'no_show')}>No-show</Button>}
            {r.status !== 'cancelled' ? <Button variant="danger" onClick={() => setStatus(r, 'cancelled')}>Cancel</Button> : <Button onClick={() => setStatus(r, 'registered')}>Restore</Button>}</span> : null },
        ]} /><Pagination data={data} onPage={setPage} /></>)}
      {can('registrations.manage') && event.status === 'published' && (
        <div className="a-inlineform"><h3>Add a registration</h3>
          <Field label="Name" error={err.name}>{(id) => <input id={id} className="a-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Email" error={err.email}>{(id) => <input id={id} className="a-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          <Button variant="primary" onClick={add}>Add</Button>{err.form && !err.name && !err.email && <p className="a-error" role="alert">{err.form}</p>}</div>)}
    </Modal>
  )
}

/* ---------- item dialog (view, edit, status, extras) ---------- */
function ItemDialog({ cfg, item, onClose, onSaved }) {
  const { can } = useAuth()
  const toast = useToast()
  const creating = !item
  const [form, setForm] = useState(() => toForm(item, cfg.fields))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState(item)
  const [move, setMove] = useState(null)
  const [regs, setRegs] = useState(false)
  const [note, setNote] = useState('')
  const editable = creating ? can(`${cfg.perm}.create`) : can(`${cfg.perm}.update`)

  const save = async () => {
    setBusy(true); setErrors({})
    try {
      const res = await api(creating ? cfg.base : `${cfg.base}/${current.id}`, { method: creating ? 'POST' : 'PATCH', body: toPayload(form, cfg.fields) })
      toast(creating ? `${cfg.noun} created` : 'Changes saved')
      onSaved(); if (creating) onClose(); else setCurrent(res.item)
    } catch (e) { setErrors({ ...e.details, form: e.message }) } finally { setBusy(false) }
  }
  const act = async (fn, msg) => { try { const r = await fn(); if (r?.item) setCurrent(r.item); toast(msg); onSaved() } catch (e) { toast(e.message, 'bad') } }
  const remove = () => act(async () => { await api(`${cfg.base}/${current.id}`, { method: 'DELETE' }); onClose() }, `${cfg.noun} deleted`)

  return (
    <Modal open onClose={onClose} wide title={creating ? `New ${cfg.noun.toLowerCase()}` : current.name ?? current.title}
      footer={editable && <><Button onClick={onClose}>Close</Button><Button variant="primary" busy={busy} onClick={save}>{creating ? `Create ${cfg.noun.toLowerCase()}` : 'Save changes'}</Button></>}>
      {!creating && (
        <div className="a-statusbar">
          <span>Status: <Badge value={current.status} />{current.published !== undefined && <> {current.published ? <Badge value="published">Public</Badge> : <Badge value="draft">Not public</Badge>}</>}{current.featured && <> <Badge value="active">Featured</Badge></>}</span>
          <span className="a-actions a-actions--wrap">
            {current.allowedTransitions.map((to) => <Button key={to} onClick={() => setMove(to)}>{label(to)}</Button>)}
            {can(`${cfg.perm}.publish`) && cfg.featurable && <Button onClick={() => act(() => api(`${cfg.base}/${current.id}/feature`, { method: 'POST', body: { featured: !current.featured } }), current.featured ? 'Removed from featured' : 'Featured')}>{current.featured ? 'Unfeature' : 'Feature'}</Button>}
            {cfg.key === 'projects' && can('projects.publish') && <Button onClick={() => act(() => api(`${cfg.base}/${current.id}/publish`, { method: 'POST', body: { published: !current.published } }), current.published ? 'Unpublished' : 'Published')}>{current.published ? 'Unpublish' : 'Publish'}</Button>}
            {cfg.key === 'events' && can('registrations.read') && <Button onClick={() => setRegs(true)}>Registrations ({current.stats?.registered ?? 0})</Button>}
          </span>
        </div>)}
      {current?.sample && <p className="a-note">Sample record: this came from placeholder site content and has not been verified.</p>}
      {current?.status === 'cancelled' && current.cancelReason && <p className="a-note a-note--bad">Cancelled: {current.cancelReason}</p>}
      <div className="a-formgrid">
        {cfg.fields.map((f) => (
          <div key={f.name} className={f.wide ? 'is-wide' : undefined}>
            <Field label={f.label + (f.required ? ' *' : '')} error={errors[f.name]} hint={f.hint}>{(id) => (editable ? <FieldInput f={f} id={id} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} /> : <p className="a-readonly">{String(form[f.name] || '-')}</p>)}</Field>
          </div>))}
      </div>
      {errors.form && <p className="a-error" role="alert">{errors.form}</p>}
      {!creating && cfg.preview && <section className="a-preview"><h3>Public preview</h3>{cfg.preview(current)}</section>}
      {!creating && cfg.key === 'projects' && (
        <section><h3>Review</h3>
          {current.evidence && <p className="a-muted">Market Ready confirmed {fmtDate(current.evidence.confirmedAt)}: {current.evidence.note}</p>}
          <ul className="a-list">{(current.statusHistory ?? []).slice().reverse().map((h, i) => <li key={i}><span>{label(h.status)}{h.note && <small className="a-muted"> · {h.note}</small>}</span><span className="a-muted">{fmtDate(h.at)}</span></li>)}</ul>
          {(current.reviewNotes ?? []).map((n, i) => <p key={i} className="a-note"><b>{n.byName}</b>: {n.note}</p>)}
          {can('projects.update') && <div className="a-inlineform"><input className="a-input" aria-label="Review note" placeholder="Add a review note" value={note} onChange={(e) => setNote(e.target.value)} /><Button disabled={note.trim().length < 2} onClick={() => act(async () => { const r = await api(`${cfg.base}/${current.id}/notes`, { method: 'POST', body: { note } }); setNote(''); return r }, 'Note added')}>Add note</Button></div>}
        </section>)}
      {!creating && can(`${cfg.perm}.delete`) && <p><Button variant="danger" onClick={() => { if (window.confirm(`Delete this ${cfg.noun.toLowerCase()}? This cannot be undone.`)) remove() }}>Delete {cfg.noun.toLowerCase()}</Button></p>}
      {move && <Transition base={cfg.base} item={current} to={move} onClose={() => setMove(null)} onDone={(r) => { setMove(null); setCurrent(r.item); toast(r.notifications ?? `Moved to ${label(move)}`); onSaved() }} />}
      {regs && <Registrations event={current} onClose={() => { setRegs(false); onSaved() }} />}
    </Modal>
  )
}

/* ---------- generic page ---------- */
function ResourcePage({ cfg }) {
  const { can } = useAuth()
  const [f, setF] = useState({ q: '', status: '', page: 1 })
  const { data, loading, error, reload } = useList(cfg.base, f)
  const [open, setOpen] = useState(null) // item | 'new'
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }))
  return (
    <>
      <PageHead title={cfg.title} sub={cfg.sub} actions={can(`${cfg.perm}.create`) && <Button variant="primary" onClick={() => setOpen('new')}>New {cfg.noun.toLowerCase()}</Button>} />
      <Filters>
        <input className="a-input" type="search" aria-label={`Search ${cfg.title.toLowerCase()}`} placeholder="Search" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <select className="a-input" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All statuses</option>{(data?.statuses ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
      </Filters>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <><Table columns={cfg.columns} rows={data.items} onRow={setOpen} empty={<Empty title={`No ${cfg.title.toLowerCase()} yet`} body={`Create the first ${cfg.noun.toLowerCase()} to get started.`} />} />
          <Pagination data={data} onPage={(page) => setF((x) => ({ ...x, page }))} /></>)}
      {open && <ItemDialog cfg={cfg} item={open === 'new' ? null : open} onClose={() => setOpen(null)} onSaved={reload} />}
    </>
  )
}

/* ---------- configuration for each resource ---------- */
const slug = { name: 'slug', label: 'Slug', required: true, hint: 'Lowercase letters, numbers and hyphens. Used in the page address.' }
const col = (key, title, render) => ({ key, title, render })
const statusCol = col('status', 'Status', (r) => <Badge value={r.status} />)
const updated = col('updatedAt', 'Updated', (r) => fmtDate(r.updatedAt))

const groupFields = [
  { name: 'name', label: 'Name', required: true }, slug, { name: 'tagline', label: 'Tagline' }, { name: 'group', label: 'Category' },
  { name: 'about', label: 'About', type: 'textarea', required: true, wide: true }, { name: 'topics', label: 'Topics', type: 'lines', required: true, wide: true },
  { name: 'rules', label: 'Rules (shown to members when they join)', type: 'lines', wide: true }, { name: 'accent', label: 'Accent colour', hint: 'Like #f6dbc0' }, { name: 'logo', label: 'Logo path', hint: 'A path on this site, like /logos/ai.svg' },
]
const groupPreview = (c) => <div className="a-prevcard" style={{ '--acc': c.accent || '#ff7a1a' }}><b>{c.name}</b><span>{c.tagline}</span><p>{c.about}</p></div>

const CONFIG = {
  communities: { key: 'communities', title: 'Communities', noun: 'Community', sub: 'The communities visitors can join.', base: '/communities', perm: 'communities', featurable: true, fields: groupFields, preview: groupPreview, columns: [col('name', 'Name', (r) => <b>{r.name}</b>), col('group', 'Category', (r) => r.group || '-'), statusCol, col('f', 'Featured', (r) => (r.featured ? 'Yes' : '-')), updated] },
  cohorts: { key: 'cohorts', title: 'Cohorts', noun: 'Cohort', sub: 'Technology cohorts and their pages.', base: '/cohorts', perm: 'cohorts', featurable: true, fields: groupFields, preview: groupPreview, columns: [col('name', 'Name', (r) => <b>{r.name}</b>), col('group', 'Category', (r) => r.group || '-'), statusCol, updated] },
  events: {
    key: 'events', title: 'Events', noun: 'Event', sub: 'Workshops, webinars and meetups. Times are entered in your browser time zone.', base: '/events', perm: 'events', featurable: true,
    fields: [
      { name: 'title', label: 'Title', required: true, wide: true }, slug, { name: 'category', label: 'Category', required: true },
      { name: 'shortDescription', label: 'Short description', type: 'textarea', required: true, wide: true }, { name: 'overview', label: 'Overview', type: 'textarea', wide: true },
      { name: 'format', label: 'Format', type: 'select', options: ['Online', 'In-person', 'Hybrid'], default: 'Online' }, { name: 'venueName', label: 'Venue' }, { name: 'timeZone', label: 'Event time zone', default: 'Asia/Kolkata' },
      { name: 'startDateTime', label: 'Starts', type: 'datetime', required: true }, { name: 'endDateTime', label: 'Ends', type: 'datetime', required: true },
      { name: 'registrationOpensAt', label: 'Registration opens', type: 'datetime' }, { name: 'registrationDeadline', label: 'Registration closes', type: 'datetime' },
      { name: 'capacity', label: 'Capacity', type: 'number', hint: 'Leave empty for unlimited.' },
      { name: 'topics', label: 'Topics', type: 'lines', wide: true }, { name: 'speakers', label: 'Speakers and hosts', type: 'people', wide: true },
    ],
    preview: (e) => <div className="a-prevcard"><b>{e.title}</b><span>{fmtDate(e.startDateTime)} · {e.format}</span><p>{e.shortDescription}</p></div>,
    columns: [col('title', 'Event', (r) => <b>{r.title}</b>), col('start', 'Starts', (r) => fmtDate(r.startDateTime)), col('fmt', 'Format', (r) => r.format), statusCol, col('reg', 'Registered', (r) => `${r.stats.registered}${r.capacity ? ` / ${r.capacity}` : ''}`)],
  },
  projects: {
    key: 'projects', title: 'Projects', noun: 'Project', sub: 'Market Push listings. Only reviewed projects should be published.', base: '/projects', perm: 'projects', featurable: true,
    fields: [
      { name: 'name', label: 'Name', required: true }, slug, { name: 'category', label: 'Category', required: true }, { name: 'summary', label: 'Summary', type: 'textarea', required: true, wide: true },
      { name: 'problem', label: 'Problem', type: 'textarea', wide: true }, { name: 'solution', label: 'Solution', type: 'textarea', wide: true }, { name: 'audience', label: 'Intended audience' }, { name: 'stage', label: 'Current stage' },
      { name: 'availability', label: 'Availability and access', wide: true }, { name: 'features', label: 'Key features', type: 'lines', wide: true }, { name: 'tech', label: 'Technology', type: 'lines' }, { name: 'team', label: 'Team', type: 'people' },
    ],
    preview: (p) => <div className="a-prevcard"><b>{p.name}</b><span>{label(p.status)} · {p.category}</span><p>{p.summary}</p></div>,
    columns: [col('name', 'Project', (r) => <b>{r.name}</b>), col('category', 'Category', (r) => r.category), statusCol, col('pub', 'Public', (r) => (r.published ? 'Yes' : 'No')), col('int', 'Interest', (r) => r.interestCount), updated],
  },
}

export const Communities = () => <ResourcePage cfg={CONFIG.communities} />
export const Cohorts = () => <ResourcePage cfg={CONFIG.cohorts} />
export const Events = () => <ResourcePage cfg={CONFIG.events} />
export const Projects = () => <ResourcePage cfg={CONFIG.projects} />
