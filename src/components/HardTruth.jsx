import { useEffect, useRef, useState } from 'react'
import { challenges } from '../data/challenges'

export default function HardTruth() {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)

  // Cards ease in once when the section scrolls into view.
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setSeen(true)
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section id="hard-truth" className="section section--dark" ref={ref}>
      <div className="container">
        <header className="section__head">
          <p className="eyebrow">The hard truth</p>
          <h2>Talent isn’t the problem. <span className="grad">The environment is.</span></h2>
          <p className="lead">
            Many people have high potential, but without the right environment, ideas never move beyond thinking.
          </p>
        </header>

        <ul className={`glass-grid${seen ? ' is-in' : ''}`}>
          {challenges.map((c, i) => (
            <li key={c.title} className="glass" style={{ '--hue': c.hue, '--i': i }}>
              <span className="glass__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d={c.icon} /></svg>
              </span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <span className="glass__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            </li>
          ))}
        </ul>

        <div className="truth-callout">
          <h3>What if you could fix all of this in one place?</h3>
          <p>Walk in with an idea. Train models. Build solutions. Walk out ready to develope the real product.</p>
        </div>
      </div>
    </section>
  )
}
