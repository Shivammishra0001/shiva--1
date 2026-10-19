import { cohorts } from '../data/cohorts'
import { site } from '../data/siteContent'

export default function Cohorts() {
  return (
    <section id="cohorts" className="section section--dark-alt section--compact">
      <div className="container">
        <header className="section__head">
          <p className="eyebrow"></p>
          <h2>In the Roof of Intelligence. Build Something Big.</h2>
          <p className="lead">Secure your residence in our intensive programs to build, validate, and launch disruptive startups. Join us and build something big.</p>
        </header>
        <ul className="grid grid--4">
          {cohorts.map((c) => (
            <li key={c.id} className="card card--cohort">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={c.icon} /></svg>
              <h3>{c.title}</h3>
              <p>{c.summary}</p>
              <a
                className="cohort__go"
                href={`mailto:${site.email}?subject=${encodeURIComponent(`${c.title} enquiry`)}`}
                aria-label={`Ask about ${c.title}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
