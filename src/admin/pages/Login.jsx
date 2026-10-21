import { useState } from 'react'
import { useAuth } from '../auth'
import { Button, Field } from '../ui'

export default function Login() {
  const { signIn, expired } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await signIn(form.email.trim(), form.password) } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <div className="a-login">
      <form className="a-login__card" onSubmit={submit} noValidate>
        <img src="/logo-96.png" alt="" width="48" height="48" />
        <h1>Admin sign in</h1>
        <p className="a-muted">Data Science Co-Working Space</p>
        {expired && <p className="a-note" role="status">Your session expired. Sign in again to continue.</p>}
        <Field label="Email">{(id) => <input id={id} type="email" className="a-input" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />}</Field>
        <Field label="Password">{(id) => <input id={id} type="password" className="a-input" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}</Field>
        {error && <p className="a-error" role="alert">{error}</p>}
        <Button variant="primary" type="submit" busy={busy} disabled={!form.email || !form.password}>Sign in</Button>
        <a className="a-muted a-login__back" href="/">← Back to the public site</a>
      </form>
    </div>
  )
}
