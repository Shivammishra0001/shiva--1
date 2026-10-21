// Wraps the Community and Cohort pages. Not signed in: sent to the sign-in page and brought back afterwards.
// Signed in but policies changed (or email not verified when required): a short step before the page opens.
// This only controls what the browser shows. The API enforces the same rules on every request.
import { useEffect, useState } from 'react'
import { api, syncMine } from '../lib/community'
import { loadMe, mfetch, useMember } from './session'

const Screen = ({ title, children }) => (
  <section className="mb-gate" aria-live="polite"><div className="mb-gate__card"><h1>{title}</h1>{children}</div></section>
)

function PolicyAccept({ user, versions }) {
  const [ok, setOk] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = user.pendingPolicies
  const all = pending.every((p) => ok[p.id])
  const accept = async () => {
    setBusy(true); setError('')
    try { await mfetch('/api/auth/accept-policies', { method: 'POST', body: { accept: true, versions } }); await loadMe() } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <Screen title="Our policies were updated">
      <p>Please review and accept the updated {pending.length === 1 ? 'policy' : 'policies'} to keep taking part.</p>
      <fieldset className="mb-consent">
        {pending.map((p) => (
          <label key={p.id}><input type="checkbox" checked={!!ok[p.id]} onChange={(e) => setOk({ ...ok, [p.id]: e.target.checked })} /> <span>I accept the updated <a href={`/legal.html?doc=${p.id}`} target="_blank" rel="noopener">{p.title}</a><span className="sr-only"> (opens in a new tab)</span></span></label>
        ))}
      </fieldset>
      {error && <p className="mb-err" role="alert">{error}</p>}
      <button type="button" className="mb-btn" disabled={!all || busy} onClick={accept}>{busy && <span className="mb-spin" aria-hidden="true" />}Accept and continue</button>
    </Screen>
  )
}

function VerifyNotice({ user }) {
  const [state, setState] = useState('')
  const resend = async () => { setState('sending'); try { await mfetch('/api/auth/resend-verification', { method: 'POST' }); setState('sent') } catch (e) { setState(e.message) } }
  return (
    <Screen title="Verify your email to continue">
      <p>We sent a link to <b>{user.email}</b>. Open it to unlock the Community and Cohort areas.</p>
      {state === 'sent' && <p className="mb-note" role="status">If your inbox does not have it yet, check again in a minute.</p>}
      {state && state !== 'sent' && state !== 'sending' && <p className="mb-err" role="alert">{state}</p>}
      <button type="button" className="mb-btn" onClick={resend} disabled={state === 'sending'}>Send the link again</button>
      <button type="button" className="mb-link" onClick={loadMe}>I have verified. Refresh</button>
    </Screen>
  )
}

// Decisions about a member's own content or account, with an appeal option.
function Notices({ user }) {
  const [appealing, setAppealing] = useState(null)
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const dismiss = async (id) => { await mfetch(`/api/auth/notices/${id}/read`, { method: 'POST' }).catch(() => {}); loadMe() }
  const send = async (e) => {
    e.preventDefault()
    try { const r = await mfetch('/api/community/appeals', { method: 'POST', body: { actionId: appealing.actionId, message: text } }); setResult(r.message); setAppealing(null); setText(''); dismiss(appealing.id) } catch (err) { setResult(err.message) }
  }
  if (!user.notices.length && !result) return null
  return (
    <div className="mb-notices" role="region" aria-label="Messages about your account">
      {result && <p className="mb-note" role="status">{result}</p>}
      {user.notices.map((n) => (
        <div key={n.id} className="mb-notice"><p>{n.message}</p>
          <span>{n.appealable && <button type="button" className="mb-link" onClick={() => { setAppealing(n); setResult('') }}>Appeal</button>}<button type="button" className="mb-link" onClick={() => dismiss(n.id)}>Dismiss</button></span></div>
      ))}
      {appealing && (
        <form onSubmit={send} className="mb-appeal">
          <label htmlFor="mb-ap">Why should this be reviewed again? A different reviewer will read it.</label>
          <textarea id="mb-ap" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          <span><button type="button" className="mb-link" onClick={() => setAppealing(null)}>Cancel</button><button type="submit" className="mb-btn" disabled={text.trim().length < 10}>Send appeal</button></span>
        </form>
      )}
    </div>
  )
}

export default function MemberGate({ children }) {
  const m = useMember()
  const user = m.user
  useEffect(() => {
    if (m.status === 'ready' && !user) window.location.replace(`/signin.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}&required=1`)
  }, [m.status, user])
  // Keep the community's local identity (used for avatars and joins) in step with the signed-in account.
  useEffect(() => { if (user) { api.signIn({ name: user.name, role: 'Member' }); syncMine() } }, [user])

  if (m.status === 'loading') return <Screen title="Checking your account…"><p className="mb-sub">One moment.</p></Screen>
  if (!user) return <Screen title="Sign in to take part"><p>The Community and Cohort areas are for members. Taking you to sign in…</p><a className="mb-btn mb-btn--link" href="/signin.html?required=1">Sign in or create an account</a></Screen>
  if (user.pendingPolicies.length) return <PolicyAccept user={user} versions={m.versions} />
  if (m.verificationRequired && !user.emailVerified) return <VerifyNotice user={user} />
  return <><Notices user={user} />{children}</>
}
