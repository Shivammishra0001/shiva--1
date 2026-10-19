import { features } from '../data/features'

export default function WhatYouGet() {
  return (
    <section id="what-you-get" className="section section--dark section--grain">
      <div className="container">
        <header className="section__head">
          <p className="eyebrow">What you get when you sit here</p>
          <h2>This isn’t a classroom. This is a builder’s workspace.</h2>
          <p className="lead">
            Every seat puts you in an environment designed for people who want to build, launch and grow real products.
          </p>
        </header>
        <ul className="grid grid--3">
          {features.map((f) => (
            <li key={f.id} id={f.id === 'ai-sark' ? 'ai-sark' : undefined} className="card card--dark">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={f.icon} /></svg>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <ul className="ticks">
                {f.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
