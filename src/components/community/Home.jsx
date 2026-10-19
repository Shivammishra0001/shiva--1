import { useEffect, useRef, useState } from 'react'
import { communities, communityHref } from '../../data/communities'
import { num, dateOf, useAllEvents } from '../../lib/community'
import { Icon, Logo, SampleBadge, SmartLink } from './ui'

const STEPS = ['Learn Together', 'Share & Build', 'Grow Your Network', 'Join Events']
const byId = (id) => communities.find((c) => c.id === id)

// Collage cards: photo cards use the site's own photography, poster cards use the community marks.
const COLS = [
  [
    { img: '/images/coworking-hero.jpg', pos: '12% 50%', chips: ['ai'] },
    { poster: 'ai' },
    { img: '/images/about-why.jpg', pos: '50% 40%', chips: ['cloud', 'quantum'] },
  ],
  [
    { poster: 'neo4j' },
    { img: '/images/about-hero.jpg', pos: '30% 50%', chips: ['neo4j'] },
    { img: '/images/coworking-hero.jpg', pos: '88% 50%', chips: ['cybersecurity'] },
  ],
  [
    { img: '/images/about-hero.jpg', pos: '82% 50%', chips: ['quantum', 'ai'] },
    { poster: 'cloud' },
    { poster: 'cybersecurity' },
  ],
]

function Chips({ ids }) {
  return (
    <span className="yh-chips">
      {ids.map((id) => { const c = byId(id); return c && <span key={id} className="yh-chip"><Logo community={c} size="xs" decorative /></span> })}
    </span>
  )
}

function Collage() {
  return (
    <div className="yh-collage" aria-hidden="true">
      {COLS.map((col, i) => (
        <div key={i} className={`yh-col yh-col--${i}`}>
          {col.map((card, j) => {
            if (card.poster) {
              const c = byId(card.poster)
              return (
                <div key={j} className="yh-card yh-card--poster" style={{ '--acc': c.accent }}>
                  <Logo community={c} size="lg" decorative />
                  <b>{c.name}</b>
                  <small>{c.group}</small>
                </div>
              )
            }
            return (
              <div key={j} className="yh-card" style={{ backgroundImage: `url(${card.img})`, backgroundPosition: card.pos }}>
                <Chips ids={card.chips} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function Hero() {
  const { data } = useAllEvents()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setStep((n) => (n + 1) % STEPS.length), 3200)
    return () => clearInterval(t)
  }, [])
  const e = data?.find((x) => x.featured && x.upcoming) ?? data?.find((x) => x.upcoming)
  return (
    <section className="cm-hero yh" aria-labelledby="cm-h1">
      <div className="yh-frame">
        <Collage />
        <h1 id="cm-h1" className="yh-title"><span>Find</span><span>Your</span><span>People</span></h1>
        <p> </p>
        <div className="yh-cta">
          <a className="yh-btn yh-btn--solid" href="#communities">Explore Communities</a>
          <a className="yh-btn yh-btn--line" href="#events"><svg viewBox="0 0 10 12" width="9" height="11" aria-hidden="true"><path d="M0 0l10 6-10 6z" fill="currentColor" /></svg>Discover Events</a>
        </div>
        
      </div>

      
    </section>
  )
}

// Row order; anything missing from the data is skipped.
const ROW = ['ai', 'cybersecurity', 'neo4j', 'quantum', 'cloud']

export function CommunityRow() {
  const items = ROW.map((id) => communities.find((c) => c.id === id)).filter(Boolean)
  const scroller = useRef(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const measure = () => {
    const el = scroller.current
    if (el) setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const by = (dir) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section id="communities" className="section section--dark cm-sec" aria-labelledby="cm-title">
      <div className="cm-wrap">
        <header className="cm-sec__row">
          <div>
            <h2 id="cm-title">Explore Communities</h2>
            <p className="lead">Join a community, share ideas, work on projects and connect with people who care about the same technologies.</p>
          </div>
          <div className="cm-sec__actions">
            <button type="button" className="cm-round" onClick={() => by(-1)} disabled={edge.start} aria-label="Scroll communities left"><Icon name="chevronLeft" /></button>
            <button type="button" className="cm-round" onClick={() => by(1)} disabled={edge.end} aria-label="Scroll communities right"><Icon name="chevronRight" /></button>
            <SmartLink href="/community.html?view=communities" className="cm-viewall">View All Communities <Icon name="arrowRight" /></SmartLink>
          </div>
        </header>
        <ul ref={scroller} onScroll={measure} className="cm-circles" aria-label="Communities">
          {items.map((c) => (
            <li key={c.id}>
              <SmartLink href={communityHref(c)} className="cm-circle" style={{ '--acc': c.accent }}>
                <span className="cm-circle__ring"><span className="cm-circle__in"><span className="cm-glyph" style={{ WebkitMaskImage: `url(${c.logo})`, maskImage: `url(${c.logo})` }} /></span></span>
                <span className="cm-circle__name">{c.name}</span>
                <span className="cm-pill">{num(c.followers)} followers</span>
              </SmartLink>
            </li>
          ))}
        </ul>
        {<p className="cm-muted cm-xs cm-circles__note"><SampleBadge>Demo counts</SampleBadge> Follower counts are demo figures until real followers are tracked.</p>}
      </div>
    </section>
  )
}

export function HostCTA() {
  return (
    <section className="section section--dark cm-sec" aria-labelledby="cm-end">
      <div className="cm-wrap"><div className="cm-banner2">
        <div><h2 id="cm-end">Want to host a workshop or webinar?</h2>
          <p>We’re always looking for great ideas from researchers, practitioners and community members. Propose an event and help grow our AI community.</p></div>
        <a className="cm-btn cm-btn--primary" href="/contact.html">Propose an Event <Icon name="arrowRight" /></a>
      </div></div>
    </section>
  )
}

