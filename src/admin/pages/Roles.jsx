// Role management. Permission boxes you do not hold yourself are disabled (the server enforces this too).
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, ErrorState, Field, Loading, Modal, PageHead, useList, useToast } from '../ui'

function RoleForm({ role, catalogue, onClose, onSaved }) {
  const { can } = useAuth()
  const [form, setForm] = useState({ name: role?.name ?? '', description: role?.description ?? '', permissions: role?.permissions ?? [] })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const toggle = (p) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }))
  const save = async () => {
    setBusy(true); setErrors({})
    try { await api(role ? `/roles/${role.id}` : '/roles', { method: role ? 'PATCH' : 'POST', body: form }); onSaved() } catch (e) { setErrors({ ...e.details, form: e.message }) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} wide title={role ? `Edit ${role.name}` : 'New role'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={save}>Save role</Button></>}>
      <Field label="Name" error={errors.name}>{(id) => <input id={id} className="a-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
      <Field label="Description" error={errors.description}>{(id) => <input id={id} className="a-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
      <div className="a-perms">{catalogue.map((g) => (
        <fieldset key={g.group} className="a-checks"><legend>{g.group}</legend>
          {g.permissions.map((p) => <label key={p.key} title={can(p.key) ? undefined : 'You do not hold this permission, so you cannot grant it.'}><input type="checkbox" checked={form.permissions.includes(p.key)} disabled={!can(p.key)} onChange={() => toggle(p.key)} />{p.label}</label>)}
        </fieldset>))}</div>
      {errors.permissions && <p className="a-error">{errors.permissions}</p>}
      {errors.form && <p className="a-error" role="alert">{errors.form}</p>}
    </Modal>
  )
}

// A role that is still in use can only be deleted after its users are moved to another role.
function DeleteRole({ role, roles, onClose, onDone }) {
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async () => {
    setBusy(true); setError('')
    try { await api(`/roles/${role.id}`, { method: 'DELETE', body: role.userCount ? { reassignTo: to } : {} }); onDone() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Delete ${role.name}?`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" busy={busy} disabled={role.userCount > 0 && !to} onClick={run}>Delete role</Button></>}>
      {role.userCount ? <>
        <p className="a-muted">{role.userCount} user(s) have this role. Choose a role to move them to.</p>
        <Field label="Move users to">{(id) => <select id={id} className="a-input" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a role</option>{roles.filter((r) => r.id !== role.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}</Field>
      </> : <p className="a-muted">No one has this role. This cannot be undone.</p>}
      {error && <p className="a-error" role="alert">{error}</p>}
    </Modal>
  )
}

export default function Roles() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useList('/roles')
  const [edit, setEdit] = useState(null) // role | 'new'
  const [del, setDel] = useState(null)
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} retry={reload} />
  const manage = can('roles.manage')
  return (
    <>
      <PageHead title="Roles" sub="Roles bundle permissions. You can only grant permissions you hold yourself." actions={manage && <Button variant="primary" onClick={() => setEdit('new')}>New role</Button>} />
      <div className="a-cards">{data.items.map((r) => (
        <article key={r.id} className="a-card">
          <h2>{r.name} {r.system && <Badge value="draft">System</Badge>}</h2>
          <p className="a-muted">{r.description || 'No description.'}</p>
          <p><b>{r.permissions.length}</b> permissions · <b>{r.userCount}</b> {r.userCount === 1 ? 'user' : 'users'}</p>
          {r.users.length > 0 && <p className="a-muted a-small">{r.users.map((u) => u.name).join(', ')}{r.userCount > r.users.length ? '…' : ''}</p>}
          <details><summary>View permissions</summary><ul className="a-chips">{r.permissions.map((p) => <li key={p}>{p}</li>)}</ul></details>
          {manage && r.key !== 'super_admin' && <div className="a-actions"><Button onClick={() => setEdit(r)}>Edit</Button>{!r.system && <Button variant="danger" onClick={() => setDel(r)}>Delete</Button>}</div>}
        </article>))}</div>
      {edit && <RoleForm role={edit === 'new' ? null : edit} catalogue={data.catalogue} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast('Role saved'); reload() }} />}
      {del && <DeleteRole role={del} roles={data.items} onClose={() => setDel(null)} onDone={() => { setDel(null); toast('Role deleted'); reload() }} />}
    </>
  )
}
