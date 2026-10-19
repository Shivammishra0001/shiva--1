import { useState } from 'react'
import Navbar from './components/Navbar'
import About from './components/About'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'

// Separate page (about.html), not part of the landing page.
export default function AboutPage() {
  const [booking, setBooking] = useState(false)
  const openBooking = () => setBooking(true)
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={openBooking} />
      <main id="main">
        <About onBook={openBooking} />
      </main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}
