import { useEffect, useRef, useState } from 'react'
import { cohorts, communities, communityHref } from '../data/communities'
import { navLinks, site } from '../data/siteContent'
import { signOut, useMember } from '../member/session'

const find = (list, ids) => ids.map((id) => list.find((c) => c.id === id)).filter(Boolean)
const mask = (src) => ({ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` })

// Dropdown menus for the Cohort and Community links.
const MENUS = {
  cohorts: {
    id: 'cohort-menu', label: 'Cohorts', noun: 'cohort',
    cols: [
      { title: 'AI platforms', items: find(cohorts, ['openai', 'anthropic', 'gemini', 'huggingface', 'deepseek', 'sarvam']) },
      { title: 'Data and compute', items: find(cohorts, ['databricks', 'neo4j-cohort', 'nvidia']) },
    ],
  },
  communities: {
    id: 'community-menu', label: 'Communities', noun: 'community', allLabel: 'See all communities',
    cols: [
      { title: 'Artificial intelligence', items: find(communities, ['ai', 'ai-governance']) },
      { title: 'Compute and cloud', items: find(communities, ['quantum', 'cloud']) },
    ],
  },
}

// Hover, focus or the caret button opens the menu; the card on the right follows the item you point at.
function MegaMenu({ link, menu, onNavigate, index }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(menu.cols[0].items[0])
  const timer = useRef(null)
  const root = useRef(null)
  const show = () => { clearTimeout(timer.current); setOpen(true) }
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 160) }
  useEffect(() => () => clearTimeout(timer.current), [])
  const go = () => { setOpen(false); onNavigate() }
  return (
    <li ref={root} style={{ '--i': index }} className={`nav__has-menu${open ? ' is-open' : ''}`} onMouseEnter={show} onMouseLeave={hide}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget)) setOpen(false) }}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <a href={link.href} onClick={onNavigate}>{link.label}</a>
      <button type="button" className="nav__caret" aria-expanded={open} aria-controls={menu.id} aria-label={`Show ${menu.label.toLowerCase()}`} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={menu.id} className="nav__drop" role="region" aria-label={menu.label}>
          {menu.cols.map((col) => (
            <div className="nav__col" key={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.items.map((c) => (
                  <li key={c.id}>
                    <a href={communityHref(c)} onMouseEnter={() => setActive(c)} onFocus={() => setActive(c)} onClick={go} style={{ '--acc': c.accent }}>
                      <span className="nav__mark2" aria-hidden="true" style={mask(c.logo)} />
                      <span><b>{c.name}</b><small>{c.tagline}</small></span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="nav__feature" style={{ '--acc': active.accent }}>
            <span className="nav__flogo" aria-hidden="true"><span style={mask(active.logo)} /></span>
            <p className="nav__fkicker">{active.group}</p>
            <h3>{active.name} {menu.noun}</h3>
            <p>{active.about}</p>
            <a className="nav__fgo" href={communityHref(active)} onClick={go}>Enter {menu.noun} <span aria-hidden="true">›››</span></a>
          </div>
          {menu.allLabel && <a className="nav__all" href={link.href} onClick={go}>{menu.allLabel} →</a>}
        </div>
      )}
    </li>
  )
}

export default function Navbar({ onBook }) {
  const member = useMember()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Lock page scroll behind the full-screen mobile menu.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const close = () => setOpen(false)

  return (
    <header className={`nav${open ? ' is-open' : ''}`}>
      <div className="container nav__inner">
        <a className="nav__brand" href="/#home" onClick={close}>
          <img className="nav__mark" src="/logo-96.png" width="44" height="44" alt="" />
          {site.shortName}
        </a>

        <nav id="primary-nav" className={`nav__menu${open ? ' is-open' : ''}`} aria-label="Primary">
          <ul className="nav__links">
            {navLinks.map((l, i) => (MENUS[l.menu]
              ? <MegaMenu key={l.href} link={l} menu={MENUS[l.menu]} onNavigate={close} index={i} />
              : (
                <li key={l.href} style={{ '--i': i }}>
                  <a href={l.href} onClick={close}>{l.label}</a>
                </li>
              )))}
          </ul>
          <div className="nav__actions">
            <button type="button" className="btn btn--primary" onClick={() => { close(); onBook() }}>
              Book Your Seat
            </button>
            {member.user
              ? <><a className="btn btn--ghost" href="/profile.html" onClick={close}>Profile</a><button type="button" className="btn btn--ghost" onClick={signOut} title={`Signed in as ${member.user.name}`}>Sign out</button></>
              : <a className="btn btn--ghost" href="/signin.html" onClick={close}>Sign In</a>}
          </div>
        </nav>

        <button
          type="button"
          className="nav__toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
          <span>{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>
    </header>
  )
}
