import { useEffect, useRef, useState } from 'react'
import { contactIcons, perks, plans, seatOptions } from '../data/booking'
import { site } from '../data/siteContent'

const OWNER_WHATSAPP = '919953413662' // number that receives booking requests (wa.me format)

const pad = (n) => String(n).padStart(2, '0')
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const prettyDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
const Ico = ({ d, className = 'bk-ico' }) => <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>

export default function BookingModal({ open, onClose }) {
  const ref = useRef(null)
  const [today, setToday] = useState(() => toISODate(new Date())) // refreshed each time the dialog opens
  const [form, setForm] = useState({ name: '', phone: '', seats: 1, plan: 'daily', date: today })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // Native <dialog>: focus trap and Escape come for free.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      const t = toISODate(new Date())
      setSent(false)
      setErrors({})
      setToday(t)
      set({ date: t })
      el.showModal()
    }
    if (!open && el.open) el.close()
  }, [open])

  const plan = plans.find((p) => p.id === form.plan)

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^[6-9]\d{9}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit mobile number.'
    if (!form.date || form.date < toISODate(new Date())) next.date = 'Pick today or a future date.'
    setErrors(next)
    if (Object.keys(next).length) return

    const text = [
      'Hi! I would like to book a seat.',
      '',
      `Name: ${form.name.trim()}`,
      `WhatsApp: +91 ${form.phone}`,
      `Seats: ${form.seats}`,
      `Plan: ${plan.name}`,
      `Starting date: ${prettyDate(form.date)}`,
    ].join('\n')
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    setSent(true)
  }

  return (
    <dialog ref={ref} className="bk" aria-labelledby="bk-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="bk__wrap">
        <aside className="bk__info">
          <p className="bk__tag"><span><Ico d={contactIcons.seat} /></span>Book a seat</p>
          <h2>Grab your <span className="grad">power seat</span></h2>
          <p className="bk__lead">You’re one step away from a focused, high-performance workspace built for AI builders, data engineers and serious creators.</p>
          <ul className="bk__perks">
            {perks.map((p) => (
              <li key={p.title}>
                <span className="bk__dot"><Ico d={p.icon} /></span>
                <div><h3>{p.title}</h3><p>{p.body}</p></div>
              </li>
            ))}
          </ul>
          <ul className="bk__contact">
            <li><span className="bk__dot"><Ico d={contactIcons.phone} /></span>{site.phone}</li>
            <li><span className="bk__dot"><Ico d={contactIcons.pin} /></span>{site.location}</li>
            <li><span className="bk__dot"><Ico d={contactIcons.mail} /></span>{site.email}</li>
          </ul>
        </aside>

        <div className="bk__panel">
          <header className="bk__head">
            <div>
              <h2 id="bk-title">Book your seat</h2>
              <p>Fill in your details. We’ll confirm on WhatsApp.</p>
            </div>
            <button type="button" className="bk__close" onClick={onClose} aria-label="Close booking form">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          {sent ? (
            <div className="bk__done" role="status">
              <h3>Request ready on WhatsApp</h3>
              <p>
                We opened WhatsApp with your request for <strong>{form.seats} {form.seats === 1 ? 'seat' : 'seats'}</strong> on a <strong>{plan.name.toLowerCase()}</strong> plan,
                starting <strong>{prettyDate(form.date)}</strong>. Press <strong>Send</strong> there to finish. We’ll confirm with you on +91 {form.phone}.
              </p>
              <button type="button" className="bk__submit" onClick={onClose}>Done</button>
            </div>
          ) : (
            <form className="bk__form" onSubmit={submit} noValidate>
              <div className="bk__field">
                <label htmlFor="bk-name">Full name</label>
                <input id="bk-name" autoComplete="name" placeholder="Your full name" value={form.name}
                  onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'bk-name-e' : undefined} />
                {errors.name && <p className="bk__err" id="bk-name-e">{errors.name}</p>}
              </div>
              <div className="bk__field">
                <label htmlFor="bk-phone">WhatsApp number</label>
                <div className="bk__phone">
                  <span aria-hidden="true">+91</span>
                  <input id="bk-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="99953 43366" maxLength={10}
                    value={form.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'bk-phone-e' : undefined} />
                </div>
                {errors.phone && <p className="bk__err" id="bk-phone-e">{errors.phone}</p>}
              </div>

              <fieldset className="bk__field">
                <legend>Seats you want</legend>
                <div className="bk__seats">
                  {seatOptions.map((n) => (
                    <label key={n} className={form.seats === n ? 'is-on' : undefined}>
                      <input type="radio" name="seats" value={n} checked={form.seats === n} onChange={() => set({ seats: n })} />
                      {n}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="bk__field">
                <legend>Plan</legend>
                <div className="bk__plans">
                  {plans.map((p) => (
                    <label key={p.id} className={form.plan === p.id ? 'is-on' : undefined}>
                      <input type="radio" name="plan" value={p.id} checked={form.plan === p.id} onChange={() => set({ plan: p.id })} />
                      <strong>{p.name}</strong>
                      <span>{p.note}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="bk__field">
                <label htmlFor="bk-date">Starting date</label>
                <input id="bk-date" type="date" min={today} value={form.date}
                  onChange={(e) => set({ date: !e.target.value || e.target.value < today ? today : e.target.value })}
                  aria-invalid={!!errors.date} aria-describedby={errors.date ? 'bk-date-e' : undefined} />
                {errors.date && <p className="bk__err" id="bk-date-e">{errors.date}</p>}
              </div>

              <button type="submit" className="bk__submit"><span className="bk__send"><Ico d={contactIcons.send} /></span>Confirm my seat</button>
              <p className="bk__note">This opens WhatsApp with your details. We reply there to confirm.</p>
            </form>
          )}
        </div>
      </div>
    </dialog>
  )
}
