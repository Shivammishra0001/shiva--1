// Sign in / Create account / Forgot / Reset / Verify / Appeal, in one accessible panel.
// Switching modes keeps the non-sensitive fields (name, phone, email) but never the passwords.
import { useEffect, useState } from 'react'
import { MemberError, emailOk, loadMe, mfetch, normalisePhone, passwordChecks, phoneOk } from './session'

const Eye = ({ on }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={on ? 'M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-3 3.7M6.6 7.6A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8M9.9 10a3 3 0 0 0 4.1 4.1' : 'M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6S3.5 14 2.5 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'} /></svg>

function PasswordField({ id, label, value, onChange, error, autoComplete, describedBy, children }) {
  const [show, setShow] = useState(false)
  return (
    <div className={`mb-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="mb-pw">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={describedBy}
          spellCheck={false} />
        <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}><Eye on={show} /></button>
      </div>
      {children}
      {error && <p className="mb-err" role="alert">{error}</p>}
    </div>
  )
}

function Field({ id, label, error, hint, ...input }) {
  return (
    <div className={`mb-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} {...input} />
      {hint && !error && <p className="mb-hint" id={`${id}-h`}>{hint}</p>}
      {error && <p className="mb-err" id={`${id}-e`} role="alert">{error}</p>}
    </div>
  )
}

const Spinner = () => <span className="mb-spin" aria-hidden="true" />

export default function AuthPanel({ initialMode = 'signin', onSignedIn, resetToken, verifyToken, required }) {
  const [mode, setMode] = useState(resetToken ? 'reset' : verifyToken ? 'verify' : initialMode)
  const [shared, setShared] = useState({ name: '', phone: '', email: '' })
  const [pw, setPw] = useState({ password: '', confirm: '' })
  const [consent, setConsent] = useState({ terms: false, guidelines: false, privacy: false })
  const [message, setMessage] = useState(required ? 'Community and Cohort areas are for members. Sign in, or create a free account, to take part.' : '')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [versions, setVersions] = useState(null)
  const [appeal, setAppeal] = useState('')
  const set = (patch) => setShared((s) => ({ ...s, ...patch }))

  const switchTo = (m, note = '') => { setMode(m); setPw({ password: '', confirm: '' }); setErrors({}); setMessage(note) }
  useEffect(() => { mfetch('/api/public/policies').then((r) => setVersions(Object.fromEntries(r.items.map((p) => [p.id, p.version])))).catch(() => {}) }, [])

  // Email verification links open straight into this panel.
  useEffect(() => {
    if (mode !== 'verify' || !verifyToken) return
    setBusy(true)
    mfetch('/api/auth/verify-email', { method: 'POST', body: { token: verifyToken } })
      .then(() => { setMessage('Your email address is verified. Thank you.'); loadMe() })
      .catch((e) => setErrors({ form: e.message })).finally(() => setBusy(false))
  }, [mode, verifyToken])

  const run = async (fn) => {
    setBusy(true); setErrors({})
    try { await fn() } catch (e) { if (e instanceof MemberError) setErrors({ ...e.details, form: e.message, code: e.code }); else setErrors({ form: 'Something went wrong. Try again.' }) } finally { setBusy(false) }
  }

  const signIn = (e) => { e.preventDefault(); run(async () => { const r = await mfetch('/api/auth/login', { method: 'POST', body: { email: shared.email.trim(), password: pw.password } }); await loadMe(); onSignedIn?.(r.user) }) }

  const checks = passwordChecks(pw.password)
  const registerValid = shared.name.trim().length >= 2 && phoneOk(shared.phone) && emailOk(shared.email) && checks.every((c) => c.ok) && pw.password === pw.confirm && consent.terms && consent.guidelines && consent.privacy
  const register = (e) => {
    e.preventDefault()
    run(async () => {
      await mfetch('/api/auth/register', { method: 'POST', body: { name: shared.name.trim(), email: shared.email.trim(), phone: normalisePhone(shared.phone), password: pw.password, confirmPassword: pw.confirm, acceptTerms: consent.terms, acceptGuidelines: consent.guidelines, acceptPrivacy: consent.privacy, policyVersions: versions ?? undefined } })
      try {
        const r = await mfetch('/api/auth/login', { method: 'POST', body: { email: shared.email.trim(), password: pw.password } })
        await loadMe(); onSignedIn?.(r.user)
      } catch {
        // Same message whether the account is new or already existed: we never say which.
        switchTo('signin', 'If this is a new email, your account is ready. Sign in to continue. If you already have an account, use your existing password or reset it.')
      }
    })
  }

  const forgot = (e) => { e.preventDefault(); run(async () => { const r = await mfetch('/api/auth/forgot-password', { method: 'POST', body: { email: shared.email.trim() } }); setMessage(r.message) }) }
  const reset = (e) => {
    e.preventDefault()
    if (pw.password !== pw.confirm) return setErrors({ confirm: 'Passwords do not match.' })
    run(async () => { await mfetch('/api/auth/reset-password', { method: 'POST', body: { token: resetToken, password: pw.password } }); switchTo('signin', 'Your password was changed. Sign in with the new one.') })
  }
  const sendAppeal = (e) => { e.preventDefault(); run(async () => { const r = await mfetch('/api/auth/appeal', { method: 'POST', body: { email: shared.email.trim(), password: pw.password, message: appeal } }); setMessage(r.message); setMode('signin') }) }

  const tabs = (
    <div className="mb-tabs" role="tablist" aria-label="Account">
      <button type="button" role="tab" id="mb-t-in" aria-selected={mode === 'signin'} aria-controls="mb-panel" className={mode === 'signin' ? 'is-on' : ''} onClick={() => switchTo('signin')}>Sign in</button>
      <button type="button" role="tab" id="mb-t-up" aria-selected={mode === 'register'} aria-controls="mb-panel" className={mode === 'register' ? 'is-on' : ''} onClick={() => switchTo('register')}>Create account</button>
    </div>
  )
  const status = (
    <>
      {message && <p className="mb-note" role="status">{message}</p>}
      {errors.form && !Object.keys(errors).some((k) => !['form', 'code'].includes(k)) && <p className="mb-err mb-err--form" role="alert">{errors.form}</p>}
    </>
  )
  const submitBtn = (label, disabled) => <button type="submit" className="mb-btn" disabled={busy || disabled}>{busy && <Spinner />}{label}</button>
  const link = (id) => `/legal.html?doc=${id}`

  return (
    <div className="mb-card" id="mb-panel" role={mode === 'signin' || mode === 'register' ? 'tabpanel' : undefined}>
      <img className="mb-logo" src="/logo-96.png" alt="" width="52" height="52" />
      {(mode === 'signin' || mode === 'register') && tabs}

      {mode === 'signin' && (
        <form onSubmit={signIn} noValidate>
          <h1>Welcome back</h1><p className="mb-sub">Sign in to join communities and cohorts.</p>
          {status}
          <Field id="mb-email" label="Email address" type="email" autoComplete="username" value={shared.email} onChange={(e) => set({ email: e.target.value })} />
          <PasswordField id="mb-pw" label="Password" value={pw.password} onChange={(v) => setPw({ ...pw, password: v })} autoComplete="current-password" />
          {errors.code === 'suspended' && <p className="mb-note"><button type="button" className="mb-link" onClick={() => switchTo('appeal')}>Appeal this decision</button></p>}
          {submitBtn('Sign in', !emailOk(shared.email) || !pw.password)}
          <p className="mb-row"><button type="button" className="mb-link" onClick={() => switchTo('forgot')}>Forgot password?</button><button type="button" className="mb-link" onClick={() => switchTo('register')}>Create an account</button></p>
          <p className="mb-hint">Staff: the same email and password work here and at <a href="/admin">/admin</a>.</p>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={register} noValidate>
          <h1>Create your account</h1><p className="mb-sub">Free. We only ask for what we need.</p>
          {status}
          <Field id="mb-name" label="Full name" autoComplete="name" value={shared.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
          <Field id="mb-phone" label="Phone number" type="tel" autoComplete="tel" placeholder="+91 99953 43366" hint="Include the country code. We do not verify phone numbers yet." value={shared.phone} onChange={(e) => set({ phone: e.target.value })} error={errors.phone || (shared.phone && !phoneOk(shared.phone) ? 'Use the format +91 99953 43366.' : '')} />
          <Field id="mb-email" label="Email address" type="email" autoComplete="email" value={shared.email} onChange={(e) => set({ email: e.target.value })} error={errors.email || (shared.email && !emailOk(shared.email) ? 'Enter a valid email address.' : '')} />
          <PasswordField id="mb-pw" label="Password" value={pw.password} onChange={(v) => setPw({ ...pw, password: v })} autoComplete="new-password" error={errors.password} describedBy="mb-rules">
            <ul className="mb-rules" id="mb-rules" aria-label="Password rules">{checks.map((c) => <li key={c.id} className={c.ok ? 'is-ok' : ''}><span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.text}<span className="sr-only">{c.ok ? ' (met)' : ' (not met)'}</span></li>)}</ul>
          </PasswordField>
          <PasswordField id="mb-pw2" label="Confirm password" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" error={errors.confirmPassword || (pw.confirm && pw.confirm !== pw.password ? 'Passwords do not match.' : '')} />
          <fieldset className="mb-consent">
            <legend className="sr-only">Agreements</legend>
            {[['terms', 'I agree to the', 'terms', 'Terms and Conditions', errors.acceptTerms], ['guidelines', 'I agree to follow the', 'guidelines', 'Community Guidelines', errors.acceptGuidelines], ['privacy', 'I have read and acknowledge the', 'privacy', 'Privacy Policy', errors.acceptPrivacy]].map(([k, pre, doc, name, err]) => (
              <label key={k}><input type="checkbox" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} /> <span>{pre} <a href={link(doc)} target="_blank" rel="noopener">{name}</a><span className="sr-only"> (opens in a new tab)</span>{err && <em className="mb-err"> {err}</em>}</span></label>
            ))}
          </fieldset>
          {submitBtn('Create account', !registerValid)}
          <p className="mb-row"><span>Already have an account?</span><button type="button" className="mb-link" onClick={() => switchTo('signin')}>Sign in</button></p>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={forgot} noValidate>
          <h1>Reset your password</h1><p className="mb-sub">Enter your email. If it has an account, we will send instructions.</p>
          {status}
          <Field id="mb-email" label="Email address" type="email" autoComplete="email" value={shared.email} onChange={(e) => set({ email: e.target.value })} />
          {submitBtn('Send reset instructions', !emailOk(shared.email))}
          <p className="mb-row"><button type="button" className="mb-link" onClick={() => switchTo('signin')}>← Back to sign in</button></p>
        </form>
      )}

      {mode === 'reset' && (
        <form onSubmit={reset} noValidate>
          <h1>Choose a new password</h1>{status}
          <PasswordField id="mb-pw" label="New password" value={pw.password} onChange={(v) => setPw({ ...pw, password: v })} autoComplete="new-password" error={errors.password}>
            <ul className="mb-rules" aria-label="Password rules">{checks.map((c) => <li key={c.id} className={c.ok ? 'is-ok' : ''}><span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.text}</li>)}</ul>
          </PasswordField>
          <PasswordField id="mb-pw2" label="Confirm new password" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" error={errors.confirm} />
          {submitBtn('Save new password', !checks.every((c) => c.ok) || pw.password !== pw.confirm)}
        </form>
      )}

      {mode === 'verify' && (
        <div><h1>Email verification</h1>{busy ? <p className="mb-sub">Checking your link…</p> : status}
          {!busy && <p className="mb-row"><a className="mb-btn mb-btn--link" href="/community.html">Continue</a></p>}</div>
      )}

      {mode === 'appeal' && (
        <form onSubmit={sendAppeal} noValidate>
          <h1>Appeal a suspension</h1><p className="mb-sub">Confirm it is you, then tell us why the decision should be reviewed. A different reviewer will read it.</p>
          {status}
          <Field id="mb-email" label="Email address" type="email" value={shared.email} onChange={(e) => set({ email: e.target.value })} />
          <PasswordField id="mb-pw" label="Password" value={pw.password} onChange={(v) => setPw({ ...pw, password: v })} autoComplete="current-password" />
          <div className="mb-field"><label htmlFor="mb-appeal">Your message</label><textarea id="mb-appeal" rows={4} maxLength={1000} value={appeal} onChange={(e) => setAppeal(e.target.value)} /></div>
          {submitBtn('Send appeal', !emailOk(shared.email) || !pw.password || appeal.trim().length < 10)}
          <p className="mb-row"><button type="button" className="mb-link" onClick={() => switchTo('signin')}>← Back to sign in</button></p>
        </form>
      )}
    </div>
  )
}
