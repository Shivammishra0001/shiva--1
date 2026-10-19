import { amenities } from '../data/amenities'

export default function Amenities() {
  return (
    <section id="amenities" className="section section--dark section--strip">
      <div className="container amenity-strip">
        <h2></h2>
        <ul className="amenities">
          {amenities.map((a) => (
            <li key={a.label}>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={a.icon} /></svg>
              {a.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
