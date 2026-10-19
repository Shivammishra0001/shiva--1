import { useEffect, useMemo, useRef, useState } from 'react'
import { api, dateOf, pageBase, setParams, timeOf, toast, useAllEvents, useAuth, useParams, getEventBySlug, communityName } from '../../lib/community'
import { getDurationHours } from '../../utils/eventHelpers'
import { communityHref } from '../../data/communities'
import { EmptyState, Icon, Loader, SampleBadge, SmartLink, Spinner } from './ui'

// Cover photos: one real, openly licensed photograph per category (public/events). Credits: public/events/CREDITS.txt.
const ART = {
  'Workshop': 'workshop', 'Webinar': 'webinar', 'Learning Cohort': 'cohort',
  'Research Talk': 'research', 'Community Meetup': 'meetup', 'Hands-on Lab': 'lab',
}
export const art = (e) => ({ backgroundImage: `url(/events/${ART[e.category] || 'workshop'}.jpg)` })

// href that opens an event while keeping the rest of the URL (community, tab, filters)
const useEventHref = () => {
  const params = useParams()
  return (slug) => {
    const p = new URLSearchParams(params)
    p.set('event', slug)
    return `${pageBase()}?${p.toString()}`
  }
}

const CHIPS = [
  { label: 'All Events', value: '' }, { label: 'Workshops', value: 'Workshop' }, { label: 'Webinars', value: 'Webinar' },
  { label: 'Learning Cohorts', value: 'Learning Cohort' }, { label: 'Research Talks', value: 'Research Talk' }, { label: 'Community Meetups', value: 'Community Meetup' },
]
const SAVED_KEY = 'dscw.events.saved'
const readSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || [] } catch { return [] } }
const tzLabel = (tz) => (tz === 'Asia/Kolkata' ? 'IST' : tz)

export function EventCard({ event }) {
  const href = useEventHref()(event.slug)
  const [saved, setSaved] = useState(() => readSaved().includes(event.id))
  const toggle = () => {
    const next = !saved
    setSaved(next)
    try { const list = readSaved().filter((id) => id !== event.id); localStorage.setItem(SAVED_KEY, JSON.stringify(next ? [...list, event.id] : list)) } catch { /* private mode */ }
  }
  const when = `${new Date(event.startDateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: event.timeZone })} · ${timeOf(event.startDateTime, event.timeZone).toUpperCase()} ${tzLabel(event.timeZone)}`
  const host = event.sampleNote ? 'Stanford (sample listing)' : event.speakers[0]?.name ?? 'Data Science Co-Working'
  return (
    <article className="cm-ev">
      <div className="cm-ev__media">
        <SmartLink href={href} className="cm-ev__cover" style={art(event)} aria-label={`${event.title}, view details`} />
        <button type="button" className={`cm-ev__save${saved ? ' is-on' : ''}`} aria-pressed={saved} aria-label={saved ? `Remove ${event.title} from saved` : `Save ${event.title}`} onClick={toggle}><Icon name="heart" /></button>
      </div>
      <div className="cm-ev__body">
        <h3><SmartLink href={href} className="cm-card__link">{event.title}</SmartLink></h3>
        <p className="cm-ev__when">{when}{event.format === 'Online' && <span className="cm-ev__tag"><Icon name="video" />Online</span>}</p>
        <p className="cm-ev__by">by {host}<span aria-hidden="true"> • </span>{event.category}</p>
        <p className="cm-ev__seats"><span className={`cm-ev__dot${event.open ? ' is-open' : ''}`} aria-hidden="true" />{event.open ? 'Registration open' : event.statusLabel}{event.format !== 'Online' && <> · {event.format}</>} · {getDurationHours(event.durationMinutes)}</p>
      </div>
    </article>
  )
}

export function EventsExplorer() {
  const { data, loading } = useAllEvents()
  const [search, setSearch] = useState('')
  const [when, setWhen] = useState('upcoming')
  const [category, setCategory] = useState('')
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState('')

  const topics = useMemo(() => [...new Set((data ?? []).flatMap((e) => e.topics))].sort(), [data])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (data ?? []).filter((e) => (when === 'past' ? e.past : e.upcoming) &&
      (!category || e.category === category) && (!topic || e.topics.includes(topic)) && (!format || e.format === format) &&
      (!q || e.title.toLowerCase().includes(q) || e.speakers.some((s) => s.name.toLowerCase().includes(q)) ||
        e.shortDescription.toLowerCase().includes(q) || e.topics.some((t) => t.toLowerCase().includes(q))))
    return when === 'past' ? list.reverse() : list
  }, [data, when, category, topic, format, search])
  const reset = () => { setSearch(''); setWhen('upcoming'); setCategory(''); setTopic(''); setFormat('') }
  const past = (data ?? []).filter((e) => e.past).reverse()

  return (
    <>
      <section id="events" className="section section--dark cm-sec" aria-labelledby="ev-title">
        <div className="cm-wrap">
          <header className="cm-sec__row">
            <div>
              <h2 id="ev-title">Upcoming Events</h2>
              <p className="lead">Join our upcoming workshops, webinars and cohort programs.</p>
            </div>
            <button type="button" className="cm-viewall" onClick={reset}>View All Events <Icon name="arrowRight" /></button>
          </header>

          <div className="cm-filterpanel">
            <div className="cm-filterpanel__row">
              <label className="cm-search"><span className="sr-only">Search events, topics or speakers</span><Icon name="search" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, topics or speakers…" /></label>
              <select aria-label="Upcoming or past" value={when} onChange={(e) => setWhen(e.target.value)}><option value="upcoming">Upcoming</option><option value="past">Past</option></select>
              <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)}><option value="">All Formats</option><option>Online</option><option>In-person</option><option>Hybrid</option></select>
              <select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All Topics</option>{topics.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="cm-chipsrow" role="group" aria-label="Event type">
              {CHIPS.map((c) => <button key={c.label} type="button" className={`cm-chip${category === c.value ? ' is-on' : ''}`} aria-pressed={category === c.value} onClick={() => setCategory(c.value)}>{c.label}</button>)}
            </div>
          </div>

          <p className="cm-dir__meta" aria-live="polite"><span>{loading ? ' ' : `${shown.length} ${when} event${shown.length === 1 ? '' : 's'}`}</span><SampleBadge>Sample events</SampleBadge></p>
          {loading ? <Loader label="Loading events" /> : shown.length ? (
            <ul className="cm-evgrid">{shown.map((e) => <li key={e.id}><EventCard event={e} /></li>)}</ul>
          ) : (
            <EmptyState icon="calendarX" title={when === 'past' ? 'No past events match.' : 'No upcoming events match.'} body="Try different filters, or check back soon."
              action={<button type="button" className="cm-btn cm-btn--ghost" onClick={reset}>Clear filters</button>} />
          )}
          <p className="cm-photocredit">Cover photos are illustrative, not from our events. Wikimedia Commons, CC BY-SA (Francesco Tosoni, MCPearson, Jorge Jaramillo, Maido Parv, Gaelle Berton, Kenneth C. Zirkel). Full credits in <a href="/events/CREDITS.txt">CREDITS.txt</a>.</p>
        </div>
      </section>

      <section id="past-events" className="section section--dark cm-sec cm-sec--tight" aria-labelledby="past-title">
        <div className="cm-wrap">
          <header className="cm-sec__row"><div><h2 id="past-title">Past Events</h2><p className="lead">Catch up on our previous sessions, recordings and resources.</p></div></header>
          {past.length ? (
            <ul className="cm-pastgrid">{past.map((e) => <li key={e.id}><PastCard event={e} /></li>)}</ul>
          ) : <EmptyState icon="calendarX" title="No past events yet." body="Recordings and resources will appear here after our first sessions." />}
        </div>
      </section>
    </>
  )
}

function PastCard({ event }) {
  const href = useEventHref()(event.slug)
  return (
    <article className="cm-past">
      <span className="cm-past__thumb" style={art(event)} aria-hidden="true" />
      <div>
        <h3><SmartLink href={href} className="cm-card__link">{event.title}</SmartLink></h3>
        <p className="cm-muted cm-sm"><Icon name="calendar" /> {dateOf(event.startDateTime, event.timeZone)}</p>
        <p className="cm-past__cta">View details <Icon name="arrowRight" /></p>
      </div>
    </article>
  )
}

function Registration({ event }) {
  const [form, setForm] = useState({ name: '', email: '', note: '' })
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const reg = event.registration

  if (reg) {
    return (
      <div className="cm-regdone" role="status">
        <h3>Registration saved</h3>
        <p>We saved your registration for <b>{reg.name}</b> ({reg.email}) in this browser.</p>
        <p className="cm-muted cm-sm">This website doesn’t have a server yet, so organisers aren’t notified automatically. Keep the event date in your calendar.</p>
        <button type="button" className="cm-btn cm-btn--ghost is-sm" onClick={() => { api.cancelRegistration(event.id); toast('Registration removed', { tone: 'info' }) }}>Remove my registration</button>
      </div>
    )
  }
  if (!event.open) {
    const why = event.past ? 'This event has finished.' : event.status === 'registration_closed' ? 'Registration is closed for this event.'
      : event.status === 'published' ? 'Registration hasn’t opened yet.' : 'Registration is no longer available for this event.'
    return <p className="cm-note">{why}</p>
  }
  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter your name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true)
    try { await api.registerForEvent(event.id, form); toast('Registration saved') } finally { setPending(false) }
  }
  return (
    <form className="cm-form cm-regform" onSubmit={submit} noValidate aria-label={`Register for ${event.title}`}>
      <h3>Register for this event</h3>
      <label>Name *<input value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" aria-invalid={!!errors.name} /></label>
      {errors.name && <p className="cm-err" role="alert">{errors.name}</p>}
      <label>Email *<input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" aria-invalid={!!errors.email} /></label>
      {errors.email && <p className="cm-err" role="alert">{errors.email}</p>}
      <label>Anything we should know? <small>(optional)</small><input value={form.note} onChange={(e) => set({ note: e.target.value })} /></label>
      <button type="submit" className="cm-btn cm-btn--primary" disabled={pending}>{pending && <Spinner />}Register</button>
      <p className="cm-muted cm-xs">Your details stay on this device for now. There’s no server to receive them yet.</p>
    </form>
  )
}

// Event details: an accessible dialog driven by ?event=<slug>, so it can be linked and the back button closes it.
export function EventModal() {
  useAuth() // re-render when registrations change
  const params = useParams()
  const ref = useRef(null)
  const slug = params.get('event')
  const event = slug ? getEventBySlug(slug) : null
  const { data: all } = useAllEvents()
  const close = () => setParams(params, { event: '' })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (event && !el.open) el.showModal()
    if (!event && el.open) el.close()
  }, [event])

  const onCohorts = pageBase().includes('cohort')
  const rel = event ? (onCohorts ? event.cohorts : event.communities) : []
  const related = event && all ? all.filter((e) => e.id !== event.id && e.communities.some((c) => event.communities.includes(c))).slice(0, 3) : []
  const relatedHref = (s) => { const p = new URLSearchParams(params); p.set('event', s); return `${pageBase()}?${p.toString()}` }

  return (
    <dialog ref={ref} className="cm-evm" aria-labelledby="evm-title" onClose={() => event && close()} onClick={(e) => e.target === ref.current && close()}>
      {event && (
        <div className="cm-evm__wrap">
          <div className="cm-ev__cover cm-evm__cover" style={art(event)}>
            <span className="cm-ev__pill">{event.category}</span>
            <button type="button" className="cm-evm__x" onClick={close} aria-label="Close event details"><Icon name="x" /></button>
          </div>
          <div className="cm-evm__body">
            <p className="cm-evm__tags"><span className={`cm-ev__status${event.open ? ' is-open' : ''}`}>{event.statusLabel}</span><SampleBadge>Sample event</SampleBadge></p>
            <h2 id="evm-title">{event.title}</h2>
            <p className="cm-lead">{event.overview}</p>
            {event.sampleNote && <p className="cm-note">This listing is sample content and isn’t organised by Data Science Co-Working.</p>}
            <dl className="cm-evm__facts">
              <div><dt>Starts</dt><dd>{dateOf(event.startDateTime, event.timeZone)}, {timeOf(event.startDateTime, event.timeZone)}</dd></div>
              <div><dt>Ends</dt><dd>{dateOf(event.endDateTime, event.timeZone)}, {timeOf(event.endDateTime, event.timeZone)}</dd></div>
              <div><dt>Time zone</dt><dd>{event.timeZone}</dd></div>
              <div><dt>Duration</dt><dd>{getDurationHours(event.durationMinutes)}</dd></div>
              <div><dt>Format</dt><dd>{event.format}</dd></div>
              <div><dt>Venue</dt><dd>{event.venueName}</dd></div>
              {event.registrationDeadline && <div><dt>Register by</dt><dd>{dateOf(event.registrationDeadline, event.timeZone)}</dd></div>}
              {event.audience && <div><dt>Who it’s for</dt><dd>{event.audience}</dd></div>}
              {event.prerequisites && <div><dt>Prerequisites</dt><dd>{event.prerequisites}</dd></div>}
            </dl>
            {event.topics.length > 0 && <><h3>Topics</h3><ul className="cm-chips">{event.topics.map((t) => <li key={t}>{t}</li>)}</ul></>}
            {event.learningOutcomes?.length > 0 && <><h3>What you’ll learn</h3><ul className="cm-bullets">{event.learningOutcomes.map((t) => <li key={t}>{t}</li>)}</ul></>}
            {event.agenda?.length > 0 && <><h3>Agenda</h3><ul className="cm-agenda">{event.agenda.map((a) => <li key={a.time + a.title}><b>{a.time}</b>{a.title}</li>)}</ul></>}
            {event.speakers.length > 0 && <><h3>{event.speakers.length > 1 ? 'Speakers' : 'Speaker'}</h3><ul className="cm-agenda">{event.speakers.map((s) => <li key={s.name}><b>{s.avatar}</b><span><strong>{s.name}</strong>, {s.role}</span></li>)}</ul></>}
            <Registration event={event} />
            {rel.length > 0 && (
              <><h3>Related {onCohorts ? 'cohorts' : 'communities'}</h3>
                <ul className="cm-chips">{rel.map((c) => <li key={c}><SmartLink href={communityHref({ slug: c, cohort: onCohorts })}>{communityName(c)}</SmartLink></li>)}</ul></>
            )}
            {related.length > 0 && (
              <><h3>Related events</h3>
                <ul className="cm-agenda">{related.map((r) => <li key={r.id}><b>{dateOf(r.startDateTime, r.timeZone).split(',')[1]?.trim() ?? ''}</b><SmartLink href={relatedHref(r.slug)}>{r.title}</SmartLink></li>)}</ul></>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
