import { testimonials } from '../data/testimonials'

export default function Testimonials() {
  const hasUnverified = testimonials.some((t) => !t.verified)
  return (
    <section id="testimonials" className="section section--dark section--grain section--grain-b">
      <div className="container">
        <header className="section__head">
          <p className="eyebrow">Real people. Real results.</p>
<h2>What our members say</h2>
          </header>
        <ul className="grid grid--3">
          {testimonials.map((t) => (
            <li key={t.name} className="card card--dark card--quote">
              <blockquote>
                <p>“{t.quote}”</p>
              </blockquote>
              <p className="person">
                <span className="person__avatar" aria-hidden="true">
                  {t.name.split(' ').map((w) => w[0]).join('')}
                </span>
                <span>
                  <strong>{t.name}</strong>
                  <span className="person__role">{t.role}</span>
                </span>
              </p>
            </li>
          ))}
        </ul>
        {hasUnverified && (
          <p className="fineprint">Sample testimonials, pending member confirmation.</p>
        )}
      </div>
    </section>
  )
}
