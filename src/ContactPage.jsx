import { useState } from 'react'
import Navbar from './components/Navbar'
import Contact from './components/Contact'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'

// Separate page (contact.html), not part of the landing page.
export default function ContactPage() {
  const [booking, setBooking] = useState(false)
  return (
    <>
      <a className="skip-link" href="#contact">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main>
        <Contact />
      </main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}
