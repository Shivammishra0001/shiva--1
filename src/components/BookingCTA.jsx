import { site } from '../data/siteContent'

const benefits = ['High-speed Wi-Fi', 'Expert mentors and guidance', 'AI-Shark opportunity', 'AC and distraction-free focus zone']

export default function BookingCTA({ onBook }) {
  return (
    <section id="book" className="section section--dark">
      <div className="container">
        <div className="booking">
          <h2>Your future self will thank you</h2>
          <p className="lead">
            Every day you wait is a day someone else grabs the opportunity you wanted. Stop scrolling. Start building. Book your seat right now.
          </p>
          <ul className="booking__benefits">
            {benefits.map((b) => <li key={b}>{b}</li>)}
          </ul>
                    <div className="booking__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={onBook}>Book My Seat</button>
            <a className="btn btn--light-outline btn--lg" href={site.phoneHref}>Call {site.phone}</a>
          </div>
          <p className="booking__note">No long-term contracts. Just show up, plug in and start building.</p>
        </div>
      </div>
    </section>
  )
}
