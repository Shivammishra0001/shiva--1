import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryIcons, projectFilters, projectStatuses, projects } from '../data/projects'
import { setParams, useParams } from '../lib/community'

const ORBS = [
  { img: '/events/meetup.jpg', x: 52, y: -9, s: 30, pos: '30% 40%' },
  { img: '/events/webinar.jpg', x: 0, y: 8, s: 38, pos: '60% 50%' },
  { img: '/images/coworking-hero.jpg', x: 62, y: 20, s: 36, pos: '85% 50%' },
  { img: '/events/workshop.jpg', x: 38, y: 47, s: 34, pos: '45% 50%' },
  { img: '/images/about-why.jpg', x: 74, y: 58, s: 38, pos: '50% 50%' },
  { img: '/events/lab.jpg', x: 14, y: 82, s: 36, pos: '40% 40%' },
]
const STEPS = ['Idea', 'Prototype', 'Market ready']

const Icon = ({ d }) => <svg className="mk-ico" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
const Status = ({ status }) => <span className={`mk-status mk-status--${status}`}>{projectStatuses[status].label}</span>
const Sample = () => <span className="mk-sample">Sample project</span>

function Hero() {
  const lead = projects[0]
  return (
    <section className="mk-hero section--dark" aria-labelledby="mk-title">
      <div className="mk-hero__frame">
        <p className="mk-hero__brand">Market Push</p>
        <div className="mk-hero__disc" aria-hidden="true" />
        <div className="mk-hero__copy">
          <p className="mk-eyebrow">Projects • Innovation • Market readiness</p>
          <h1 id="mk-title"><span>From Ideas to</span> Market-Ready Solutions</h1>
          <p className="mk-hero__sub">Discover practical AI and technology projects built by our community, from early prototypes to solutions ready for real-world use.</p>
          <div className="mk-hero__cta">
            <a className="mk-btn mk-btn--main" href="#projects">Explore Projects</a>
            <a className="mk-btn mk-btn--ghost" href="/contact.html">Build With Us</a>
          </div>
          <ol className="mk-steps" aria-label="From idea to market">
            {STEPS.map((s, i) => <li key={s} className={i === 0 ? 'is-on' : undefined}>{s}</li>)}
          </ol>
        </div>
        <ul className="mk-hero__orbs" aria-hidden="true">
          {ORBS.map((o) => <li key={o.img + o.x} style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.s}%`, backgroundImage: `url(${o.img})`, backgroundPosition: o.pos }} />)}
        </ul>
        {lead && <p className="mk-hero__cap">Featured: {lead.name}</p>}
      </div>
    </section>
  )
}

function Cover({ p }) {
  return (
    <div className="mk-cover" style={{ '--acc': p.accent }} aria-hidden="true">
      <Icon d={categoryIcons[p.category] ?? categoryIcons.AI} />
    </div>
  )
}

function Card({ p, open }) {
  const meta = projectStatuses[p.status]
  return (
    <article className="mk-card" style={{ '--acc': p.accent }}>
      <Cover p={p} />
      <div className="mk-card__body">
        <p className="mk-card__tags"><Status status={p.status} />{p.sample && <Sample />}<span className="mk-cat">{p.category}</span></p>
        <h3><a href={`?project=${p.slug}`} onClick={(e) => { e.preventDefault(); open(p.slug) }}>{p.name}</a></h3>
        <p className="mk-card__sum">{p.summary}</p>
        <p className="mk-card__prob"><b>Problem</b>{p.problem}</p>
        {p.tech.length > 0 && <ul className="mk-tags">{p.tech.map((t) => <li key={t}>{t}</li>)}</ul>}
        <p className="mk-card__foot">
          <span>{p.team.length ? `Built by ${p.team.map((m) => m.name).join(', ')}` : ''}</span>
          <button type="button" className="mk-link" onClick={() => open(p.slug)}>{meta.cta} <span aria-hidden="true">›››</span></button>
        </p>
      </div>
    </article>
  )
}

function Detail() {
  const params = useParams()
  const ref = useRef(null)
  const slug = params.get('project')
  const p = projects.find((x) => x.slug === slug)
  const close = () => setParams(params, { project: '' })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (p && !el.open) el.showModal()
    if (!p && el.open) el.close()
  }, [p])
  const related = p ? projects.filter((x) => x.slug !== p.slug).slice(0, 3) : []
  return (
    <dialog ref={ref} className="mk-dlg" aria-labelledby="mk-dlg-title" onClose={() => p && close()} onClick={(e) => e.target === ref.current && close()}>
      {p && (
        <div className="mk-dlg__wrap" style={{ '--acc': p.accent }}>
          <Cover p={p} />
          <button type="button" className="mk-dlg__x" onClick={close} aria-label="Close project details">×</button>
          <div className="mk-dlg__body">
            <p className="mk-card__tags"><Status status={p.status} />{p.sample && <Sample />}<span className="mk-cat">{p.category}</span></p>
            <h2 id="mk-dlg-title">{p.name}</h2>
            <p className="mk-lead">{p.summary}</p>
            {p.sample && <p className="mk-note">This is a placeholder record taken from sample community content. It has not been verified, and the details may change.</p>}
            <dl className="mk-facts">
              <div><dt>Problem</dt><dd>{p.problem}</dd></div>
              <div><dt>Solution</dt><dd>{p.solution}</dd></div>
              <div><dt>Intended audience</dt><dd>{p.audience}</dd></div>
              <div><dt>Current stage</dt><dd>{p.stage}</dd></div>
              <div><dt>Availability</dt><dd>{p.availability}</dd></div>
            </dl>
            {p.features.length > 0 && <><h3>Key features</h3><ul className="mk-bullets">{p.features.map((f) => <li key={f}>{f}</li>)}</ul></>}
            {p.tech.length > 0 && <><h3>Technology</h3><ul className="mk-tags">{p.tech.map((t) => <li key={t}>{t}</li>)}</ul></>}
            {p.team.length > 0 && <><h3>Team</h3><ul className="mk-bullets">{p.team.map((m) => <li key={m.name}><b>{m.name}</b>, {m.role}</li>)}</ul></>}
            {p.roadmap?.length > 0 && <><h3>Roadmap</h3><ul className="mk-bullets">{p.roadmap.map((r) => <li key={r}>{r}</li>)}</ul></>}
            {related.length > 0 && <><h3>Related projects</h3><ul className="mk-bullets">{related.map((r) => <li key={r.slug}><a href={`?project=${r.slug}`} onClick={(e) => { e.preventDefault(); setParams(params, { project: r.slug }) }}>{r.name}</a></li>)}</ul></>}
            <div className="mk-dlg__cta">
              <a className="mk-btn mk-btn--main" href="/contact.html">{p.status === 'market' ? 'Request access' : 'Express interest'}</a>
              <button type="button" className="mk-btn mk-btn--ghost" onClick={close}>Back to projects</button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}

export default function MarketApp() {
  const [filter, setFilter] = useState('all')
  const params = useParams()
  const open = (slug) => setParams(params, { project: slug })
  const counts = useMemo(() => Object.fromEntries(projectFilters.map((f) => [f.id, f.match ? projects.filter((p) => f.match.includes(p.status)).length : projects.length])), [])
  const active = projectFilters.find((f) => f.id === filter)
  const shown = active.match ? projects.filter((p) => active.match.includes(p.status)) : projects
  return (
    <>
      <Hero />
      <section id="projects" className="mk-sec" aria-labelledby="mk-projects">
        <header className="mk-sec__head">
          <h2 id="mk-projects">Featured projects</h2>
          <p>Projects from our community. Each one shows exactly where it stands today.</p>
        </header>
        <div className="mk-filters" role="group" aria-label="Filter by status">
          {projectFilters.map((f) => (
            <button key={f.id} type="button" className={`mk-chip${filter === f.id ? ' is-on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="mk-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        {projects.some((p) => p.sample) && <p className="mk-sampleline"><Sample /> These are placeholder records. No project has been verified as market ready yet.</p>}
        {shown.length ? (
          <ul className="mk-grid">{shown.map((p) => <li key={p.slug}><Card p={p} open={open} /></li>)}</ul>
        ) : (
          <div className="mk-empty" role="status">
            <h3>No project is verified as market ready yet.</h3>
            <p>When a project is confirmed as available to real users, it will appear here.</p>
            <button type="button" className="mk-btn mk-btn--ghost" onClick={() => setFilter('all')}>Show all projects</button>
          </div>
        )}
      </section>
      <section className="mk-cta" aria-labelledby="mk-cta">
        <h2 id="mk-cta">Have an Idea Worth Taking to Market?</h2>
        <p>Collaborate with our community to validate ideas, build prototypes and develop practical technology solutions.</p>
        <a className="mk-btn mk-btn--main" href="/contact.html">Discuss a Project</a>
      </section>
      <Detail />
    </>
  )
}
