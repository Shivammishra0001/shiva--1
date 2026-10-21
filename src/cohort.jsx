import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import MemberGate from './member/Gate'
import CohortApp from './components/CohortApp'

// Separate page (cohort.html): one page per technology cohort, opened straight from the menu.
function App() {
  const [booking, setBooking] = useState(false)
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main id="main" className="cm-pagemain"><MemberGate><CohortApp onBook={() => setBooking(true)} /></MemberGate></main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
