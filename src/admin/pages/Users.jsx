// User management: list, create, edit roles, suspend, reset password, revoke sessions, delete (soft).
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, Confirm, Empty, ErrorState, Field, Filters, Loading, Modal, PageHead, Pagination, Table, fmtDate, fmtDay, label, useList, useToast } from '../ui'

const TempPassword = ({ value, onClose, title = 'One-time password' }) => (
  <Modal open onClose={onClose} title={title} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
    <p className="a-muted">Share this securely with the user. It is shown only once, and they must change it at first sign-in.</p>
    <p className="a-secret"><code>{value}</code><Button onClick={() => navigator.clipboard?.writeText(value)}>Copy</Button></p>
  </Modal>
)

function CreateUser({ roles, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', roleIds: [] })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true); setErrors({})
    try { onDone(await api('/users', { method: 'POST', body: form })) } catch (e) { setErrors({ ...e.details, form: e.message }) } finally { setBusy(false) }
  }
  const toggle = (id) => setForm((f) => ({ ...f, roleIds: f.roleIds.includes(id) ? f.roleIds.filter((r) => r !== id) : [...f.roleIds, id] }))
  return (
    <Modal open onClose={onClose} title="New user" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={submit}>Create user</Button></>}>
      <Field label="Full name" error={errors.name}>{(id) => <input id={id} className="a-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
      <Field label="Email" error={errors.email}>{(id) => <input id={id} type="email" className="a-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
      {roles.length > 0 && <fieldset className="a-checks"><legend>Roles</legend>{roles.map((r) => <label key={r.id}><input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggle(r.id)} />{r.name}</label>)}</fieldset>}
      {errors.roleIds && <p className="a-error">{errors.roleIds}</p>}
      {errors.form && <p className="a-error" role="alert">{errors.form}</p>}
      <p className="a-hint">A temporary password is generated. The user must change it at first sign-in.</p>
    </Modal>
  )
}

// What this person takes part in: from real records, with moderation history only for people allowed to see it.
function Participation({ id }) {
  const { data, loading, error } = useList(`/users/${id}/participation`)
  if (loading && !data) return <Loading text="Loading participation" />
  if (error) return <p className="a-muted">Participation is not available: {error.message}</p>
  const p = data.profile
  return (
    <>
      <h3>Profile</h3>
      <dl className="a-facts">
        <div><dt>Email</dt><dd>{p.email} {p.emailVerified ? <Badge value="active">Verified</Badge> : <Badge value="draft">Not verified</Badge>}</dd></div>
        <div><dt>Phone</dt><dd>{p.phone ?? '-'}</dd></div><div><dt>Username</dt><dd>{p.username ? `@${p.username}` : '-'}</dd></div><div><dt>Visibility</dt><dd>{label(p.visibility)}</dd></div>
        <div><dt>Headline</dt><dd>{p.headline || '-'}</dd></div><div><dt>Bio</dt><dd>{p.bio || '-'} {p.bioStatus !== 'published' && <Badge value={p.bioStatus} />}</dd></div>
        <div><dt>Interests and skills</dt><dd>{[...p.interests, ...p.skills].join(', ') || '-'}</dd></div><div><dt>Posts · comments · projects</dt><dd>{data.counts.posts} · {data.counts.comments} · {data.counts.projects}</dd></div>
      </dl>
      <h3>Communities ({data.communities.length})</h3>
      {data.communities.length ? <ul className="a-list">{data.communities.map((c) => <li key={c.slug}><span>{c.name}</span><span className="a-muted">joined {fmtDay(c.joinedAt)}</span></li>)}</ul> : <p className="a-muted">None.</p>}
      <h3>Cohort enrolments ({data.cohorts.length})</h3>
      {data.cohorts.length ? <ul className="a-list">{data.cohorts.map((c) => <li key={c.slug}><span>{c.name} <Badge value={c.status === 'enrolled' ? 'active' : 'cancelled'}>{label(c.status)}</Badge></span><span className="a-muted">{fmtDay(c.enrolledAt)}</span></li>)}</ul> : <p className="a-muted">None.</p>}
      <h3>Event registrations ({data.events.length})</h3>
      {data.events.length ? <ul className="a-list">{data.events.map((e, i) => <li key={e.slug ?? i}><span>{e.title} <Badge value={e.status} /></span><span className="a-muted">{fmtDay(e.startDateTime)}</span></li>)}</ul> : <p className="a-muted">None.</p>}
      {data.posts.length > 0 && <><h3>Recent posts</h3><ul className="a-list">{data.posts.map((x) => <li key={x.id}><span>{x.preview} <Badge value={x.status} /></span><span className="a-muted">{fmtDay(x.createdAt)}</span></li>)}</ul></>}
      {data.moderation && <><h3>Moderation history</h3>{data.moderation.length ? <ul className="a-list">{data.moderation.map((m) => <li key={m.id}><span>{label(m.type)} · {label(m.policy)}{m.appealStatus !== 'none' && ` · appeal ${m.appealStatus}`}</span><span className="a-muted">{fmtDate(m.at)}</span></li>)}</ul> : <p className="a-muted">No actions.</p>}</>}
    </>
  )
}

function UserDrawer({ id, roles, onClose, onChanged }) {
  const { can, user: me } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useList(`/users/${id}`)
  const [dialog, setDialog] = useState(null)
  const [selected, setSelected] = useState(null)
  const [temp, setTemp] = useState(null)
  const act = async (fn, msg) => { await fn(); toast(msg); reload(); onChanged() }
  const u = data?.user
  const roleIds = selected ?? u?.roles.map((r) => r.id) ?? []
  const self = u?.id === me.id

  return (
    <Modal open onClose={onClose} title={u?.name ?? 'User'} wide>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <>
          <dl className="a-facts">
            <div><dt>Email</dt><dd>{u.email}</dd></div><div><dt>Status</dt><dd><Badge value={u.status} />{u.suspendedReason && <small className="a-muted"> {u.suspendedReason}</small>}</dd></div>
            <div><dt>Created</dt><dd>{fmtDay(u.createdAt)}</dd></div><div><dt>Last sign-in</dt><dd>{fmtDate(u.lastLoginAt)}</dd></div>
            <div><dt>Active sessions</dt><dd>{data.sessions}</dd></div>
          </dl>
          {can('users.update') && roles.length > 0 && !self && (
            <fieldset className="a-checks"><legend>Roles</legend>
              {roles.map((r) => <label key={r.id}><input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => setSelected(roleIds.includes(r.id) ? roleIds.filter((x) => x !== r.id) : [...roleIds, r.id])} />{r.name}</label>)}
              <Button variant="primary" disabled={!selected} onClick={() => setDialog('roles')}>Save roles</Button>
            </fieldset>)}
          {(!can('users.update') || roles.length === 0 || self) && <p><b>Roles:</b> {u.roles.map((r) => r.name).join(', ') || 'None'}</p>}
          <div className="a-actions a-actions--wrap">
            {can('users.suspend') && !self && u.status === 'active' && <Button onClick={() => setDialog('suspend')}>Suspend</Button>}
            {can('users.suspend') && u.status === 'suspended' && <Button onClick={() => act(() => api(`/users/${id}/reactivate`, { method: 'POST' }), 'Account reactivated')}>Reactivate</Button>}
            {can('users.update') && !self && u.status !== 'deleted' && <Button onClick={() => setDialog('reset')}>Reset password</Button>}
            {can('users.update') && !self && <Button onClick={() => setDialog('revoke')}>Sign out everywhere</Button>}
            {can('users.delete') && !self && u.status !== 'deleted' && <Button variant="danger" onClick={() => setDialog('delete')}>Delete</Button>}
          </div>
          <Participation id={id} />
          {data.activity && <><h3>Recent history</h3>{data.activity.length ? <ul className="a-list">{data.activity.map((a) => <li key={a.id}><span>{label(a.action)}<small className="a-muted"> · {a.outcome}</small></span><span className="a-muted">{fmtDate(a.at)}</span></li>)}</ul> : <p className="a-muted">No history yet.</p>}</>}
          <Confirm open={dialog === 'roles'} onClose={() => setDialog(null)} title="Change roles?" body="Roles decide what this person can see and do. Removing a role signs them out of anything it covered." confirmLabel="Save roles"
            onConfirm={() => act(() => api(`/users/${id}`, { method: 'PATCH', body: { roleIds } }).then(() => setSelected(null)), 'Roles updated')} />
          <Confirm open={dialog === 'suspend'} onClose={() => setDialog(null)} title="Suspend this account?" body="They are signed out now and cannot sign in until reactivated." confirmLabel="Suspend" danger input={{ label: 'Reason (recorded in the audit log)', min: 3 }}
            onConfirm={(reason) => act(() => api(`/users/${id}/suspend`, { method: 'POST', body: { reason } }), 'Account suspended')} />
          <Confirm open={dialog === 'reset'} onClose={() => setDialog(null)} title="Reset this password?" body="A new one-time password is generated and all of their sessions end. You will see it once." confirmLabel="Reset password" danger
            onConfirm={async () => { const r = await api(`/users/${id}/reset-password`, { method: 'POST' }); setTemp(r.temporaryPassword); reload() }} />
          <Confirm open={dialog === 'revoke'} onClose={() => setDialog(null)} title="Sign out everywhere?" body="Every active session for this account ends immediately." confirmLabel="Sign out everywhere"
            onConfirm={() => act(() => api(`/users/${id}/revoke-sessions`, { method: 'POST' }), 'Sessions ended')} />
          <Confirm open={dialog === 'delete'} onClose={() => setDialog(null)} title="Delete this account?" body="The account is deactivated and cannot sign in. Its history stays in the audit log. Type the account email to confirm." confirmLabel="Delete account" danger input={{ label: 'Account email', match: u?.email }}
            onConfirm={(confirmEmail) => act(() => api(`/users/${id}`, { method: 'DELETE', body: { confirmEmail } }).then(onClose), 'Account deleted')} />
          {temp && <TempPassword value={temp} onClose={() => setTemp(null)} title="New one-time password" />}
        </>
      )}
    </Modal>
  )
}

export default function Users() {
  const { can } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ q: '', role: '', status: '', community: '', cohort: '', createdFrom: '', createdTo: '', page: 1 })
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }))
  const { data, loading, error, reload } = useList('/users', f)
  const rolesQ = useList('/roles', {}, can('roles.read'))
  const roles = rolesQ.data?.items ?? []
  const spacesQ = useList('/communities', { pageSize: 100 }, can('communities.read'))
  const cohortsQ = useList('/cohorts', { pageSize: 100 }, can('cohorts.read'))
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [temp, setTemp] = useState(null)

  const columns = [
    { key: 'n', title: 'Name', render: (u) => <b>{u.name}</b> }, { key: 'e', title: 'Email', render: (u) => u.email },
    { key: 'r', title: 'Roles', render: (u) => u.roles.map((r) => r.name).join(', ') || <span className="a-muted">None</span> },
    { key: 's', title: 'Status', render: (u) => <Badge value={u.status} /> }, { key: 'l', title: 'Last sign-in', render: (u) => fmtDate(u.lastLoginAt) },
  ]
  return (
    <>
      <PageHead title="Users" sub="Accounts that can sign in to the admin panel." actions={can('users.create') && <Button variant="primary" onClick={() => setCreating(true)}>New user</Button>} />
      <Filters>
        <input className="a-input" type="search" aria-label="Search by name or email" placeholder="Search name or email" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        {roles.length > 0 && <select className="a-input" aria-label="Role" value={f.role} onChange={(e) => set({ role: e.target.value })}><option value="">All roles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
        {(spacesQ.data?.items.length > 0) && <select className="a-input" aria-label="Joined community" value={f.community} onChange={(e) => set({ community: e.target.value })}><option value="">Any community</option>{spacesQ.data.items.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>}
        {(cohortsQ.data?.items.length > 0) && <select className="a-input" aria-label="Enrolled cohort" value={f.cohort} onChange={(e) => set({ cohort: e.target.value })}><option value="">Any cohort</option>{cohortsQ.data.items.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>}
        <select className="a-input" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">Active and suspended</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option></select>
        <label className="a-inline">From <input className="a-input" type="date" value={f.createdFrom} onChange={(e) => set({ createdFrom: e.target.value })} /></label>
        <label className="a-inline">To <input className="a-input" type="date" value={f.createdTo} onChange={(e) => set({ createdTo: e.target.value })} /></label>
      </Filters>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <><Table columns={columns} rows={data.items} onRow={(u) => setOpen(u.id)} empty={<Empty title="No users match" body="Try a different search or filter." />} /><Pagination data={data} onPage={(page) => setF((x) => ({ ...x, page }))} /></>)}
      {creating && <CreateUser roles={roles} onClose={() => setCreating(false)} onDone={(r) => { setCreating(false); setTemp(r.temporaryPassword); toast('User created'); reload() }} />}
      {temp && <TempPassword value={temp} onClose={() => setTemp(null)} />}
      {open && <UserDrawer id={open} roles={roles} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  )
}
