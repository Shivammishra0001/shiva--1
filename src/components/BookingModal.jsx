import { useEffect, useMemo, useRef, useState } from 'react'
import { durations, perks, slotHours, topics } from '../data/booking'

const OWNER_WHATSAPP = '919953413662' // number that receives booking requests (wa.me format)

const pad = (n) => String(n).padStart(2, '0')
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const label = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`
const money = (n) => `₹${n.toLocaleString('en-IN')}`
const prettyDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BookingModal({ open, onClose }) {
  const ref = useRef(null)
  const [now, setNow] = useState(() => new Date()) // refreshed each time the dialog opens
  const today = toISODate(now)
  const [form, setForm] = useState({ name: '', phone: '', topic: topics[0], duration: '8h', date: today, hour: null })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // Native <dialog>: focus trap and Escape come for free.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      setSent(false)
      setErrors({})
      const n = new Date()
      setNow(n)
      set({ date: toISODate(n), hour: null })
      el.showModal()
    }
    if (!open && el.open) el.close()
  }, [open])

  // Slots already in the past are disabled when the chosen date is today.
  const slots = useMemo(() => {
    const isToday = form.date === toISODate(now)
    return slotHours.map((h) => ({ h, disabled: isToday && h <= now.getHours() }))
  }, [form.date, now])

  const dur = durations.find((d) => d.id === form.duration)
  const total = dur.price ? money(dur.price) : 'Price on request'

  const onDate = (e) => {
    const v = e.target.value
    if (!v || v < today) return set({ date: today, hour: null })
    const stillValid = form.hour !== null && !(v === today && form.hour <= new Date().getHours())
    set({ date: v, hour: stillValid ? form.hour : null })
  }

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^[6-9]\d{9}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit mobile number.'
    if (!form.date || form.date < today) next.date = 'Pick today or a future date.'
    if (form.hour === null) next.hour = 'Pick a start time.'
    else if (form.date === today && form.hour <= new Date().getHours()) next.hour = 'That time has passed. Pick a later slot.'
    setErrors(next)
    if (Object.keys(next).length) return

    const text = [
      'Hi! I would like to book a seat.',
      '',
      `Name: ${form.name.trim()}`,
      `WhatsApp: +91 ${form.phone}`,
      `Interested in: ${form.topic}`,
      `Duration: ${dur.hours}`,
      `Date: ${prettyDate(form.date)}`,
      `Start time: ${label(form.hour)}`,
      `Price: ${total}`,
    ].join('\n')
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    setSent(true)
  }

  return (
    <dialog ref={ref} className="bm" aria-labelledby="bm-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="bm__wrap">
        <aside className="bm__side">
          <p className="eyebrow">Work mode activated</p>
          <h2>Grab your <span className="grad">power seat</span></h2>
          <p className="lead">You’re one step away from a focused, high-performance workspace built for AI builders, data engineers and serious creators.</p>
          <ul className="bm__perks">
            {perks.map((p) => (
              <li key={p.title}>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={p.icon} /></svg>
                <div><h3>{p.title}</h3><p>{p.body}</p></div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="bm__main">
          <header className="bm__head">
            <div>
              <h2 id="bm-title">Book your seat</h2>
              <p>Fill in your details. We’ll confirm on WhatsApp.</p>
            </div>
            <button type="button" className="bm__close" onClick={onClose} aria-label="Close booking form">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          {sent ? (
            <div className="bm__done" role="status">
              <h3>Request ready on WhatsApp</h3>
              <p>
                We opened WhatsApp with your booking for <strong>{prettyDate(form.date)}</strong> at <strong>{label(form.hour)}</strong>.
                Press <strong>Send</strong> there to finish. We’ll confirm with you on +91 {form.phone}.
              </p>
              <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
            </div>
          ) : (
            <form className="bm__form" onSubmit={submit} noValidate>
              <div className="bm__row">
                <div className="field">
                  <label htmlFor="bm-name">Full name</label>
                  <input id="bm-name" autoComplete="name" placeholder="Your full name" value={form.name}
                    onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'bm-name-e' : undefined} />
                  {errors.name && <p className="field__err" id="bm-name-e">{errors.name}</p>}
                </div>
                <div className="field">
                  <label htmlFor="bm-phone">WhatsApp number</label>
                  <div className="phone">
                    <span aria-hidden="true">+91</span>
                    <input id="bm-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="99953 43366" maxLength={10}
                      value={form.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'bm-phone-e' : undefined} />
                  </div>
                  {errors.phone && <p className="field__err" id="bm-phone-e">{errors.phone}</p>}
                </div>
              </div>

              <fieldset className="field">
                <legend>What do you want to learn?</legend>
                <div className="chips">
                  {topics.map((t) => (
                    <label key={t} className={`chip${form.topic === t ? ' is-on' : ''}`}>
                      <input type="radio" name="topic" value={t} checked={form.topic === t} onChange={() => set({ topic: t })} />
                      {form.topic === t && <span aria-hidden="true">✓ </span>}{t}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="field">
                <legend>Duration</legend>
                <div className="durations">
                  {durations.map((d) => (
                    <label key={d.id} className={`dur${form.duration === d.id ? ' is-on' : ''}`}>
                      <input type="radio" name="duration" value={d.id} checked={form.duration === d.id} onChange={() => set({ duration: d.id })} />
                      {d.badge && <span className="dur__badge">{d.badge}</span>}
                      <strong>{d.hours}</strong>
                      <span>{d.note}</span>
                      <em>{d.price ? money(d.price) : 'Price on request'}</em>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="bm__row">
                <div className="field">
                  <label htmlFor="bm-date">Date</label>
                  <input id="bm-date" type="date" min={today} value={form.date} onChange={onDate}
                    aria-invalid={!!errors.date} aria-describedby={errors.date ? 'bm-date-e' : undefined} />
                  {errors.date && <p className="field__err" id="bm-date-e">{errors.date}</p>}
                </div>
                <fieldset className="field">
                  <legend>Start time</legend>
                  <div className="chips chips--time">
                    {slots.map(({ h, disabled }) => (
                      <label key={h} className={`chip${form.hour === h ? ' is-on' : ''}${disabled ? ' is-off' : ''}`}>
                        <input type="radio" name="hour" disabled={disabled} checked={form.hour === h} onChange={() => set({ hour: h })} />
                        {label(h)}
                      </label>
                    ))}
                  </div>
                  {slots.every((s) => s.disabled) && <p className="field__hint">No slots left today. Pick another date.</p>}
                  {errors.hour && <p className="field__err" role="alert">{errors.hour}</p>}
                </fieldset>
              </div>

              <div className="bm__foot">
                <p className="bm__total"><span>{form.hour === null ? 'Pick a start time' : `${prettyDate(form.date)}, ${label(form.hour)}`}</span><strong>{total}</strong></p>
                <button type="submit" className="btn btn--primary btn--lg bm__submit">Confirm my seat</button>
                <p className="bm__note">This opens WhatsApp with your details. We reply there to confirm.</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </dialog>
  )
}
