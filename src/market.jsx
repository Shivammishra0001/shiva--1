import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import MarketApp from './components/MarketApp'

// Separate page (market.html): Market Push, the project showcase.
function App() {
  const [booking, setBooking] = useState(false)
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main id="main" className="mk-page"><MarketApp /></main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
