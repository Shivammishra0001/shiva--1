import { journey } from '../data/journey'

export default function SeatToStartup() {
  return (
    <section id="journey" className="section section--light section--grain-light">
      <div className="container">
        <header className="section__head section__head--center">
          <h2>From seat to startup</h2>
        </header>
        <ol className="timeline">
          {journey.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step__marker" aria-hidden="true">{i + 1}</span>
              <h3><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
