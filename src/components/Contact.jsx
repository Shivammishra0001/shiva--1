import { useState } from 'react'
import { mapEmbedSrc, mapLinkHref, site } from '../data/siteContent'

const OWNER_WHATSAPP = '919953413662' // receives contact messages (wa.me format)
const interests = ['Book a seat', 'Cohorts', 'AI-Sark', 'Meeting rooms', 'Something else']
const fresh = () => ({ name: '', phone: '', interest: interests[0], message: '' })

export default function Contact() {
  const [form, setForm] = useState(fresh)
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter your name.'
    if (!/^[6-9]\d{9}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit mobile number.'
    setErrors(next)
    if (Object.keys(next).length) return
    const text = [
      'Hi! I have an enquiry.',
      '',
      `Name: ${form.name.trim()}`,
      `Phone: +91 ${form.phone}`,
      `Interested in: ${form.interest}`,
      ...(form.message.trim() ? [`Message: ${form.message.trim()}`] : []),
    ].join('\n')
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    setSent(true)
  }

  return (
    <section id="contact" className="section section--dark section--compact">
      <div className="container contact">
        <aside className="contact__info" aria-label="Contact details">
          <p className="eyebrow">Contact us</p>
          <h1>Come say hello. Your seat is waiting.</h1>
          <p className="lead">Drop by the space, call us or send a message. We usually reply the same day on WhatsApp.</p>
          <ul className="contact__list">
            <li><span>Visit</span>{site.location}</li>
            <li><span>Call</span><a href={site.phoneHref}>{site.phone}</a></li>
            <li><span>Email</span><a href={`mailto:${site.email}`}>{site.email}</a></li>
            <li><span>WhatsApp</span><a href={site.whatsappHref} target="_blank" rel="noopener noreferrer">Chat with us</a></li>
          </ul>
          <div className="contact__map">
            <iframe title={`Map of ${site.location}`} src={mapEmbedSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
          <a className="btn btn--outline" href={mapLinkHref} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
        </aside>
        <div className="contact__form">
          <header className="contact__head">
            <h2>Send us a message</h2>
            <p>Share your details and we’ll reply on WhatsApp.</p>
          </header>
          {sent ? (
            <div className="bm__done" role="status">
              <h3>Message ready on WhatsApp</h3>
              <p>We opened WhatsApp with your details. Press <strong>Send</strong> there to finish, and we’ll reply on +91 {form.phone}.</p>
              <button type="button" className="btn btn--outline" onClick={() => { setSent(false); setForm(fresh()) }}>Send another</button>
            </div>
          ) : (
            <form className="bm__form" onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="c-name">Name *</label>
                <input id="c-name" autoComplete="name" placeholder="Your name" value={form.name}
                  onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'c-name-e' : undefined} />
                {errors.name && <p className="field__err" id="c-name-e">{errors.name}</p>}
              </div>
              <div className="field">
                <label htmlFor="c-phone">Phone *</label>
                <div className="phone">
                  <span aria-hidden="true">+91</span>
                  <input id="c-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="99953 43366" maxLength={10}
                    value={form.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'c-phone-e' : undefined} />
                </div>
                {errors.phone && <p className="field__err" id="c-phone-e">{errors.phone}</p>}
              </div>
              <fieldset className="field">
                <legend>Interested in</legend>
                <div className="chips">
                  {interests.map((t) => (
                    <label key={t} className={`chip${form.interest === t ? ' is-on' : ''}`}>
                      <input type="radio" name="interest" value={t} checked={form.interest === t} onChange={() => set({ interest: t })} />
                      {t}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="c-msg">Tell us more</label>
                <textarea id="c-msg" rows={4} placeholder="Anything we should know?" value={form.message} onChange={(e) => set({ message: e.target.value })} />
              </div>
              <button type="submit" className="btn btn--primary btn--lg">Submit</button>
              <p className="bm__note">This opens WhatsApp with your details.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
