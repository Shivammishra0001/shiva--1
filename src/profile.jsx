// Profile page (profile.html). Own profile needs sign-in; ?u=<id> shows another member's profile if their settings allow it.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import MemberGate from './member/Gate'
import { OwnProfile, PublicProfile } from './profile/ProfilePage'

function App() {
  const [booking, setBooking] = useState(false)
  const u = new URLSearchParams(window.location.search).get('u')
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main id="main" className="pf-page">{u ? <PublicProfile id={u} /> : <MemberGate><OwnProfile /></MemberGate>}</main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
