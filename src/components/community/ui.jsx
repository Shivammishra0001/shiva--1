import { useEffect, useId, useRef, useState } from 'react'
import { api, closeAgreement, closeSignIn, closeWelcome, navigate, pageBase, toast, useAgreement, useAuthPrompt, useToasts, useWelcome } from '../../lib/community'

const P = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  searchX: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 9l4 4M13 9l-4 4',
  x: 'M18 6 6 18M6 6l12 12',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  check: 'M20 6 9 17l-5-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  messages: 'M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2zM18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1',
  more: 'M12 12h.01M19 12h.01M5 12h.01',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  video: 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM16 13l5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  pin: 'M12 17v5M9 3h6l-1 7 3 3H7l3-3z',
  bellOff: 'M8.7 3A6 6 0 0 1 18 8c0 3 .6 5 1.4 6.3M3 3l18 18M6.3 6.3C6.1 6.9 6 7.4 6 8c0 7-3 9-3 9h14M10.3 21a2 2 0 0 0 3.4 0',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUpRight: 'M7 17 17 7M7 7h10v10',
  image: 'M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 19',
  chart: 'M3 3v18h18M8 17V9M13 17V5M18 17v-6',
  rocket: 'M5 15c-1 3-1 5-1 5s2 0 5-1M12 15l-3-3a15 15 0 0 1 4-8 9 9 0 0 1 7-2 9 9 0 0 1-2 7 15 15 0 0 1-8 4z',
  plus: 'M12 5v14M5 12h14',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.500 5.500 12 3z',
  book: 'M4 4.5A2.500 2.500 0 0 1 6.500 2H20v17H6.500A2.500 2.500 0 0 0 4 21.500zM4 21.500V4.500',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  folder: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.900a2 2 0 0 1-1.700-.900L9.600 3.900A2 2 0 0 0 7.900 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 11h18',
  calendarX: 'M3 5h18v16H3zM16 3v4M8 3v4M3 11h18M10 15l4 4M14 15l-4 4',
  user: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  mapPin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  atom: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 3c3 0 3 18 0 18S9 3 12 3zM4.200 7.500c1.500-2.600 15.500 5.500 14.200 9 -1.500 2.600-15.500-5.500-14.200-9zM19.800 7.500c-1.500-2.600-15.500 5.500-14.200 9',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  loader: 'M21 12a9 9 0 1 1-6.200-8.600',
}
export const Icon = ({ name, className = '' }) => (
  <svg className={`cm-i ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d={P[name]} /></svg>
)

export const Spinner = () => <svg className="cm-i cm-spin" viewBox="0 0 24 24" aria-hidden="true"><path d={P.loader} /></svg>

export const Loader = ({ label = 'Loading' }) => (
  <div role="status" className="cm-loader"><Spinner /><span>{label}…</span></div>
)

export function EmptyState({ icon, title, body, action, as: Title = 'p' }) {
  return (
    <div className="cm-empty">
      {icon && <Icon name={icon} />}
      <Title className="cm-empty__t">{title}</Title>
      {body && <p>{body}</p>}
      {action}
    </div>
  )
}

export const SampleBadge = ({ children }) => <span className="cm-badge">{children}</span>

export const Avatar = ({ name, accent = '#f6dbc0', size = 'md' }) => (
  <span className={`cm-avatar cm-avatar--${size}`} style={{ background: accent }} aria-hidden="true">
    {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
  </span>
)

// Community mark: the real brand logo (Neo4j) or a clear topic icon, drawn in the community's accent colour.
export const Logo = ({ community, size = 'md', decorative = false }) => (
  <span className={`cm-logo cm-logo--${size}`} style={{ '--acc': community.accent }}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${community.name} logo`} aria-hidden={decorative || undefined}>
    <span className="cm-glyph" style={{ WebkitMaskImage: `url(${community.logo})`, maskImage: `url(${community.logo})` }} />
  </span>
)

// Same-page links navigate without a reload; everything else behaves normally.
export function SmartLink({ href, children, ...rest }) {
  const local = href.startsWith(pageBase())
  const onClick = (e) => {
    if (!local || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target) return
    e.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={onClick} {...rest}>{children}</a>
}

export function Menu({ label, trigger, items }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const btn = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    const key = (e) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = [...root.current.querySelectorAll('[role=menuitem]')]
        const i = els.indexOf(document.activeElement)
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    root.current?.querySelector('[role=menuitem]')?.focus()
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={root} className="cm-menu">
      <button ref={btn} type="button" className="cm-ghost" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && (
        <div id={id} role="menu" className="cm-menu__list">
          {items.filter(Boolean).map((it) => it.href
            ? <a key={it.label} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{it.icon && <Icon name={it.icon} />}{it.label}</a>
            : <button key={it.label} role="menuitem" type="button" onClick={() => { setOpen(false); btn.current?.focus(); it.onSelect() }}>{it.icon && <Icon name={it.icon} />}{it.label}</button>)}
        </div>
      )}
    </div>
  )
}

// Native <dialog>: focus trap and Escape come built in.
export function Dialog({ open, onClose, title, description, children }) {
  const ref = useRef(null)
  const tid = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog ref={ref} className="cm-dialog" aria-labelledby={tid} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="cm-dialog__box">
          <button type="button" className="cm-dialog__x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          <h2 id={tid}>{title}</h2>
          {description && <p className="cm-dialog__d">{description}</p>}
          {children}
        </div>
      )}
    </dialog>
  )
}

export function JoinButton({ joined, pending, onJoin, onLeave, small = false, showLeave = true, name, cohort = false }) {
  if (joined) {
    return (
      <div className="cm-joined">
        <span className={`cm-pill-ok${small ? ' is-sm' : ''}`}><Icon name="check" /> Joined</span>
        {showLeave && <button type="button" className="cm-ghost" onClick={onLeave} disabled={pending === 'leave'}>{pending === 'leave' && <Spinner />}Leave<span className="sr-only"> {name}</span></button>}
      </div>
    )
  }
  return (
    <button type="button" className={`cm-btn cm-btn--primary cm-join${small ? ' is-sm' : ''}`} onClick={onJoin} disabled={pending === 'join'} aria-busy={pending === 'join'}>
      {pending === 'join' ? <><Spinner /> Joining…</> : <>Join {cohort ? 'cohort' : 'community'}<span className="sr-only"> {name}</span></>}
    </button>
  )
}

// Demo sign-in: a name stored on this device only. No password, no account.
export function AuthDialog() {
  const prompt = useAuthPrompt()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) return setErr('Enter your name (at least 2 letters).')
    setBusy(true)
    const user = await api.signIn({ name, role })
    setBusy(false)
    const next = prompt?.then
    closeSignIn()
    toast(`Welcome, ${user.name.split(' ')[0]}`)
    next?.(user)
  }
  return (
    <Dialog open={!!prompt} onClose={closeSignIn} title="Create your profile" description="Pick a name to join in. This demo profile is saved only in this browser.">
      <form className="cm-form" onSubmit={submit} noValidate>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!err} placeholder="Your name" /></label>
        {err && <p role="alert" className="cm-err">{err}</p>}
        <label>Role <small>(optional)</small><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Data scientist" /></label>
        <div className="cm-dialog__row">
          <button type="button" className="cm-ghost" onClick={closeSignIn}>Not now</button>
          <button type="submit" className="cm-btn cm-btn--primary" disabled={busy}>{busy && <Spinner />}Continue</button>
        </div>
      </form>
    </Dialog>
  )
}

// Report content: pick a reason, add an optional note. The reporter's identity is never shown to other members.
const REASONS = [
  ['harassment_threats', 'Harassment or threats'], ['hate_abuse', 'Hate or targeted abuse'], ['privacy', 'Privacy violation or doxxing'], ['spam_scam', 'Spam or scam'],
  ['malicious', 'Malicious content'], ['sexual_exploitation', 'Sexual exploitation or prohibited imagery'], ['copyright', 'Copyright concern'], ['other', 'Other policy violation'],
]
export function ReportDialog({ target, onClose }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [state, setState] = useState({ busy: false, error: '', done: null })
  useEffect(() => { setReason(''); setDetails(''); setState({ busy: false, error: '', done: null }) }, [target])
  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: '', done: null })
    try { const r = await api.report({ contentType: target.type, contentId: target.id, reason, details }); setState({ busy: false, error: '', done: r }) } catch (err) { setState({ busy: false, error: err.message, done: null }) }
  }
  return (
    <Dialog open={!!target} onClose={onClose} title={state.done ? 'Report sent' : 'Report this content'} description={state.done ? undefined : 'Tell us what is wrong. A person will review it. Your name is not shown to the author or other members.'}>
      {state.done ? (
        <>
          <p>{state.done.message}</p>
          <div className="cm-dialog__row"><button type="button" className="cm-btn cm-btn--primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <form onSubmit={submit} className="cm-reportform">
          <fieldset><legend className="sr-only">Reason</legend>
            {REASONS.map(([id, label]) => <label key={id}><input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} /> {label}</label>)}
          </fieldset>
          <label className="cm-field">Anything we should know? (optional)
            <textarea rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Keep it short. Please don’t include other people’s private details." /></label>
          {state.error && <p role="alert" className="cm-err">{state.error}</p>}
          <div className="cm-dialog__row">
            <button type="button" className="cm-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cm-btn cm-btn--primary" disabled={!reason || state.busy}>{state.busy && <Spinner />}Send report</button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// Shown before a join completes: the member reads the house rules and agrees to them.
export function AgreementDialog() {
  const a = useAgreement()
  const [ok, setOk] = useState(false)
  useEffect(() => { setOk(false) }, [a])
  const agree = () => { const then = a.then; closeAgreement(); then() }
  return (
    <Dialog open={!!a} onClose={closeAgreement} title="Before you join" description={a ? `Please read and agree to the ${a.community.name} community guidelines.` : undefined}>
      {a && (
        <>
          <ol className="cm-agree__rules">{a.community.rules.map((r) => <li key={r}>{r}</li>)}</ol>
          <label className="cm-agree__check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have read the guidelines and agree to follow them.</label>
          <div className="cm-dialog__row">
            <button type="button" className="cm-ghost" onClick={closeAgreement}>Not now</button>
            <button type="button" className="cm-btn cm-btn--primary" onClick={agree} disabled={!ok}>Agree and join</button>
          </div>
        </>
      )}
    </Dialog>
  )
}

// Friendly confirmation after a successful join (never shown for errors).
export function WelcomeDialog() {
  const w = useWelcome()
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (w && !el.open) el.showModal()
    if (!w && el.open) el.close()
  }, [w])
  const first = w?.name?.trim().split(/\s+/)[0]
  return (
    <dialog ref={ref} className="cm-welcome" aria-labelledby="cm-welcome-t" onClose={closeWelcome} onClick={(e) => e.target === ref.current && closeWelcome()}>
      {w && (
        <div className="cm-welcome__box" style={{ '--acc': w.community.accent }}>
          <span className="cm-welcome__burst" aria-hidden="true" />
          <span className="cm-welcome__check" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h2 id="cm-welcome-t">{first ? `You’re in, ${first}!` : 'You’re in!'}</h2>
          <p className="cm-welcome__lead">Thanks for joining the <b>{w.community.name}</b> community. We’re glad you’re here.</p>
          <ul className="cm-welcome__tips">
            <li>Say hello on the blog and tell us what you’re building.</li>
            <li>Ask questions. Someone here has hit the same wall.</li>
            <li>Watch for workshops and talks in the Events tab.</li>
          </ul>
          <button type="button" className="cm-btn cm-btn--primary" onClick={closeWelcome} autoFocus>Start exploring</button>
        </div>
      )}
    </dialog>
  )
}

export function ToastHost() {
  const list = useToasts()
  return (
    <div className="cm-toasts" role="status" aria-live="polite">
      {list.map((t) => <p key={t.id} className={`cm-toast cm-toast--${t.tone}`}>{t.message}</p>)}
    </div>
  )
}
