// Policy pages (legal.html?doc=terms|privacy|guidelines). Text comes from the server so the version shown is the version recorded.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import { mfetch } from './member/session'

const DOCS = [['terms', 'Terms and Conditions'], ['privacy', 'Privacy Policy'], ['guidelines', 'Community Guidelines']]

function App() {
  const [booking, setBooking] = useState(false)
  const doc = DOCS.some(([id]) => id === new URLSearchParams(window.location.search).get('doc')) ? new URLSearchParams(window.location.search).get('doc') : 'terms'
  const [policy, setPolicy] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { mfetch(`/api/public/policies/${doc}`).then((r) => { setPolicy(r.policy); document.title = `${r.policy.title} | Data Science Co-Working Space` }).catch((e) => setError(e.message)) }, [doc])
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main id="main" className="mb-page mb-page--legal">
        <nav className="mb-doctabs" aria-label="Policies">{DOCS.map(([id, name]) => <a key={id} href={`/legal.html?doc=${id}`} aria-current={id === doc ? 'page' : undefined}>{name}</a>)}</nav>
        {error ? <p className="mb-err" role="alert">{error}</p> : !policy ? <p className="mb-sub">Loading…</p> : (
          <article className="mb-doc">
            <h1>{policy.title}</h1>
            <p className="mb-meta">Version {policy.version} · Effective {policy.effective}</p>
            {policy.draft && <p className="mb-note" role="note"><b>Draft.</b> {policy.note}</p>}
            {policy.sections.map((s) => (
              <section key={s.heading}><h2>{s.heading}</h2>{s.body.length > 3 && s.body.every((b) => b.length < 120) ? <ul>{s.body.map((b) => <li key={b}>{b}</li>)}</ul> : s.body.map((b) => <p key={b}>{b}</p>)}</section>
            ))}
          </article>
        )}
      </main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
