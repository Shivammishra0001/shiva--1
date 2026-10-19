import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import HardTruth from './components/HardTruth'
import WhatYouGet from './components/WhatYouGet'
import Cohorts from './components/Cohorts'
import SeatToStartup from './components/SeatToStartup'
import Testimonials from './components/Testimonials'
import BookingCTA from './components/BookingCTA'
import Amenities from './components/Amenities'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'

export default function App() {
  const [booking, setBooking] = useState(false)
  const openBooking = () => setBooking(true)

  // Pop the booking form up shortly after the landing page opens, once per browser session.
  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem('bookingPopupSeen') === '1' } catch { /* storage blocked */ }
    if (seen) return
    const t = setTimeout(() => {
      setBooking(true)
      try { sessionStorage.setItem('bookingPopupSeen', '1') } catch { /* storage blocked */ }
    }, 1500)
    return () => clearTimeout(t)
  }, [])
  return (
    <>
      <a className="skip-link" href="#hard-truth">Skip to content</a>
      <Navbar onBook={openBooking} />
      <main>
        <Hero onBook={openBooking} />
        <Amenities />
        <HardTruth />
        <WhatYouGet />
        <Cohorts />
        <SeatToStartup />
        <Testimonials />
        <BookingCTA onBook={openBooking} />
      </main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}
