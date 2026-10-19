import { useState } from 'react'
import { audience, doing, steps } from '../data/about'

// Room photo is the only project image; each use below crops a different part of it.
const PHOTO = '/images/coworking-hero.jpg'

export default function About({ onBook }) {
  const [feature, setFeature] = useState(doing[0].id)
  const [step, setStep] = useState(0)
  const active = doing.find((d) => d.id === feature)

  return (
    <>
      {/* 1. Hero / story */}
      <section className="about-hero" aria-labelledby="ab-h1">
        <div className="about-hero__bg" aria-hidden="true" />
        <div className="container about-hero__body">
          <p className="eyebrow eyebrow--hero">About AI-Sark</p>
          <h1 id="ab-h1">Good ideas deserve a place to grow.</h1>
          <p className="hero__lead">
            Some people have ideas. Some have skills. Others are ready to build something new. We bring them together in one place, where learning turns into building and building can lead to something real.
          </p>
          <div className="hero__actions">
            <a className="btn btn--light btn--lg" href="#how">Explore How We Work</a>
            <button type="button" className="btn btn--primary btn--lg" onClick={onBook}>Book Your Seat</button>
          </div>
        </div>
      </section>

      {/* 2. Why we exist */}
      <section className="section section--dark about-gap" aria-labelledby="ab-why">
        <div className="container about-split">
          <div className="about-copy">
            <p className="eyebrow">Why we exist</p>
            <h2 id="ab-why">The problem isn’t always talent. Sometimes it’s the environment.</h2>
            <p className="lead">You can learn AI, data science and development from many places. Starting a real project is harder when you are on your own.</p>
            <p className="lead">Without people to talk to, guidance, honest feedback or a place to focus, good ideas stay in notebooks. We built AI-Sark to change that.</p>
          </div>
          <figure className="about-photo about-photo--a">
            <img src="/images/about-why.jpg" alt="Pink neon sign on a concrete pillar reading Don’t just exist!" loading="lazy" width="1600" height="1067" />
          </figure>
        </div>
      </section>

      {/* 3. What we do */}
      <section className="section section--dark-alt about-gap" aria-labelledby="ab-do">
        <div className="container">
          <header className="section__head">
            <p className="eyebrow">What we do</p>
            <h2 id="ab-do">We make space for building.</h2>
          </header>
          <div className="about-do">
            <ul className="about-do__list" role="list">
              {doing.map((d) => (
                <li key={d.id}>
                  <button type="button" className={`about-do__item${feature === d.id ? ' is-on' : ''}`} aria-pressed={feature === d.id} onClick={() => setFeature(d.id)}>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={d.icon} /></svg>
                    <span><strong>{d.title}</strong><span>{d.short}</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="about-do__detail" role="region" aria-live="polite" aria-label={`${active.title} details`}>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={active.icon} /></svg>
              <h3 key={active.id}>{active.title}</h3>
              <p key={`${active.id}p`}>{active.more}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How we work */}
      <section id="how" className="section section--dark about-gap" aria-labelledby="ab-how">
        <div className="container">
          <header className="section__head">
            <p className="eyebrow">How we work</p>
            <h2 id="ab-how">From a rough idea to something real.</h2>
          </header>
          <ol className="about-steps">
            {steps.map((s, i) => (
              <li key={s.title} className={i === step ? 'is-on' : ''}>
                <button type="button" aria-expanded={i === step} aria-controls={`ab-step-${i}`} onClick={() => setStep(i)}>
                  <span className="about-steps__n" aria-hidden="true">{i + 1}</span>
                  <span className="about-steps__t">{s.title}</span>
                </button>
                <p id={`ab-step-${i}`} hidden={i !== step}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Who we are */}
      <section className="section section--dark-alt about-gap" aria-labelledby="ab-who">
        <div className="container about-split about-split--rev">
          <div className="about-copy">
            <p className="eyebrow">Who we are</p>
            <h2 id="ab-who">A space for people who want to make things happen.</h2>
            <p className="lead">AI-Sark is a community for anyone who would rather build than wait. It is a good fit if you are:</p>
            <ul className="ticks about-ticks">
              {audience.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
          <figure className="about-photo about-photo--b">
            <img src={PHOTO} alt="Open workspace with desks, laptops and plants where builders work side by side" loading="lazy" width="1933" height="814" />
          </figure>
        </div>
      </section>

      {/* 6. Belief */}
      <section className="section section--dark about-belief" aria-labelledby="ab-belief">
        <div className="container">
          <p className="eyebrow">Our belief</p>
          <h2 id="ab-belief">Learning gives you knowledge. <span className="grad">Building teaches you what you can do with it.</span></h2>
          <p className="lead">Trying things, getting feedback, working with others and doing practical work sit at the heart of the AI-Sark idea.</p>
        </div>
      </section>

      {/* 7. Closing CTA */}
      <section className="section section--dark-alt about-close" aria-labelledby="ab-cta">
        <div className="container about-close__box">
          <h2 id="ab-cta">What would you build with the right people around you?</h2>
          <p className="lead">Bring your curiosity, your skills or an unfinished idea. Take the next step toward building something real.</p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={onBook}>Book Your Seat</button>
            <a className="btn btn--ghost btn--lg" href="/#cohorts">Explore Cohorts</a>
          </div>
        </div>
      </section>
    </>
  )
}
