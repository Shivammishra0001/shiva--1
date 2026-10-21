// Operational settings. Changing them asks for the current password; integrations show status only, never secrets.
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, ErrorState, Field, Loading, PageHead, useList, useToast } from '../ui'

export default function Settings() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useList('/settings')
  const [form, setForm] = useState(null)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setForm(data.values) }, [data])
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} retry={reload} />
  if (!form) return <Loading />
  const manage = can('settings.manage')
  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== data.values[k]))
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({})
    try { await api('/settings', { method: 'PATCH', body: { currentPassword: password, changes: changed } }); setPassword(''); toast('Settings saved'); reload() } catch (err) { setErrors({ ...err.details, form: err.message }) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHead title="Settings" sub="Only settings the platform can safely support are listed." />
      <form className="a-card" onSubmit={save}>
        <div className="a-formgrid">{data.definitions.map((d) => (
          <Field key={d.key} label={d.label} hint={d.hint} error={errors[d.key]}>{(id) => d.type === 'bool'
            ? <label className="a-switch"><input id={id} type="checkbox" checked={!!form[d.key]} disabled={!manage} onChange={(e) => setForm({ ...form, [d.key]: e.target.checked })} /><span>{form[d.key] ? 'On' : 'Off'}</span></label>
            : <input id={id} className="a-input" type={d.type === 'int' ? 'number' : 'text'} value={form[d.key]} disabled={!manage} onChange={(e) => setForm({ ...form, [d.key]: d.type === 'int' ? Number(e.target.value) : e.target.value })} />}</Field>))}</div>
        {manage && <>
          <Field label="Current password (required to save)" error={errors.currentPassword}>{(id) => <input id={id} type="password" className="a-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          {errors.form && !errors.currentPassword && <p className="a-error" role="alert">{errors.form}</p>}
          <Button variant="primary" type="submit" busy={busy} disabled={!Object.keys(changed).length || !password}>Save settings</Button></>}
      </form>
      <section className="a-card"><h2>Integration status</h2><ul className="a-list">{data.integrations.map((i) => <li key={i.name}><span>{i.name}<small className="a-muted"> · {i.note}</small></span><Badge value={i.configured ? 'active' : 'draft'}>{i.configured ? 'Configured' : 'Not configured'}</Badge></li>)}</ul></section>
    </>
  )
}
