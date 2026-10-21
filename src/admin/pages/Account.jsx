// Change password (also shown full-screen when an admin has set a temporary password).
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Button, Field, PageHead, useToast } from '../ui'
import { navigate } from '../router'

export function ChangePassword({ forced }) {
  const { refresh, signOut } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return setErrors({ confirm: 'Passwords do not match.' })
    setBusy(true); setErrors({})
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
      toast('Password changed. Other devices were signed out.')
      await refresh()
      if (!forced) navigate('/admin')
    } catch (err) { setErrors({ ...err.details, form: err.message }) } finally { setBusy(false) }
  }
  const pw = (key, text, auto) => <Field label={text} error={errors[key]}>{(id) => <input id={id} type="password" className="a-input" autoComplete={auto} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required />}</Field>
  const body = (
    <form className="a-login__card" onSubmit={submit} noValidate>
      <h1>{forced ? 'Set a new password' : 'Change password'}</h1>
      <p className="a-muted">{forced ? 'Your password was set by an administrator. Choose your own to continue.' : 'Use at least 12 characters with upper and lower case letters and a number.'}</p>
      {pw('currentPassword', forced ? 'Temporary password' : 'Current password', 'current-password')}
      {pw('newPassword', 'New password', 'new-password')}
      {pw('confirm', 'Confirm new password', 'new-password')}
      {errors.form && !Object.keys(errors).filter((k) => k !== 'form').length && <p className="a-error" role="alert">{errors.form}</p>}
      <Button variant="primary" type="submit" busy={busy}>Save password</Button>
      {forced && <Button onClick={signOut}>Sign out</Button>}
    </form>
  )
  return forced ? <div className="a-login">{body}</div> : <><PageHead title="Account" sub="Manage your sign-in." /><div className="a-narrow">{body}</div></>
}
