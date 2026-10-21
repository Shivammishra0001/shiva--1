// Member sign-in / create-account page (signin.html). ?next=<page> sends people back where they were headed.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import AuthPanel from './member/AuthPanel'
import { safeNext, signOut, useMember } from './member/session'

function App() {
  const [booking, setBooking] = useState(false)
  const p = new URLSearchParams(window.location.search)
  const reset = p.get('reset'); const verify = p.get('verify')
  const m = useMember()
  // Staff who sign in here without a specific destination go to the admin dashboard; members go to Community.
  const go = (user = m.user) => window.location.assign(p.get('next') ? safeNext(p.get('next')) : user?.isStaff ? '/admin' : '/community.html')
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main id="main" className="mb-page">
        {m.user && !reset && !verify ? (
          <div className="mb-card"><h1>You are signed in</h1><p className="mb-sub">Signed in as {m.user.name}.</p>
            <p className="mb-row"><button type="button" className="mb-btn" onClick={() => go()}>{m.user.isStaff && !p.get('next') ? 'Open the admin dashboard' : 'Continue'}</button><button type="button" className="mb-link" onClick={signOut}>Sign out</button></p></div>
        ) : m.status === 'loading' ? null : (
          <AuthPanel initialMode={p.get('mode') === 'register' ? 'register' : 'signin'} resetToken={reset} verifyToken={verify} required={p.get('required') === '1'} onSignedIn={(u) => go(u)} />
        )}
      </main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
