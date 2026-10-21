// Room photo: public/images/coworking-hero.jpg. If it is missing, the CSS falls back to a plain plum tone.
export default function Hero({ onBook }) {
  return (
    <section id="home" className="hero">
      <div className="hero__bg" aria-hidden="true" />
      <div className="hero__overlay" aria-hidden="true" />
      <div className="container hero__content">
        <h1 className="hero__animate">DataScience Coworking </h1>
        <p className="hero__kicker hero__animate">India’s first dedicated data science & Ai co-working space</p>
        <p className="hero__lead hero__animate">Build your AI and data products alongside India’s top people.</p>
        <p className="hero__punch hero__animate">Stop scrolling. Start building.</p>
        <div className="hero__actions hero__animate">
          <button type="button" className="btn btn--primary btn--lg" onClick={onBook}>Book Your Seat</button>
          <a className="btn btn--light btn--lg" href="#what-you-get">See What You Get</a>
        </div>
      </div>
    </section>
  )
}
