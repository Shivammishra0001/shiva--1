import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Navbar from './components/Navbar'
import CommunityApp from './components/CommunityApp'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'

// Separate page (community.html): communities and events together.
function App() {
  const [booking, setBooking] = useState(false)
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onBook={() => setBooking(true)} />
      <main id="main" className="cm-pagemain"><CommunityApp /></main>
      <Footer />
      <BookingModal open={booking} onClose={() => setBooking(false)} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
