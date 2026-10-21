// Edit profile dialog: permitted fields only. The server validates again and ignores anything else.
import { useRef, useState } from 'react'
import { Dialog, Spinner } from '../components/community/ui'
import { toast } from '../lib/community'
import { MemberError, loadMe, mfetch } from '../member/session'
import { Avatar } from './shared'

// Shrink to a 256px square JPEG in the browser so uploads stay small.
async function resizeToDataUrl(file) {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256)
  for (const q of [0.88, 0.75, 0.6]) { const url = c.toDataURL('image/jpeg', q); if (url.length < 380_000) return url }
  throw new Error('That image is too detailed. Try a smaller one.')
}

const lines = (v) => v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)

export default function EditProfile({ user, open, onClose }) {
  const [form, setForm] = useState(() => ({ name: user.name, username: user.username, headline: user.headline, bio: user.bio, location: user.location, interests: user.interests.join(', '), skills: user.skills.join(', '), links: [...user.links, ...Array(3)].slice(0, 3).map((l) => l ?? { label: '', url: '' }) }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [picBusy, setPicBusy] = useState(false)
  const file = useRef(null)
  const set = (p) => setForm((f) => ({ ...f, ...p }))

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({})
    try {
      const r = await mfetch('/api/me/profile', { method: 'PATCH', body: {
        name: form.name, username: form.username, headline: form.headline, bio: form.bio, location: form.location,
        interests: lines(form.interests), skills: lines(form.skills), links: form.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || 'Link', url: l.url.trim() })) } })
      await loadMe()
      toast(r.held ? 'Saved. Your bio is awaiting review before others can see it.' : 'Profile saved', { tone: r.held ? 'info' : 'success' })
      onClose()
    } catch (err) { setErrors(err instanceof MemberError ? { ...err.details, form: err.message } : { form: 'Something went wrong. Try again.' }) } finally { setBusy(false) }
  }
  const pick = async (f) => {
    if (!f) return
    setPicBusy(true)
    try { await mfetch('/api/me/avatar', { method: 'PUT', body: { image: await resizeToDataUrl(f) } }); await loadMe(); toast('Profile picture updated') } catch (err) { toast(err.message, { tone: 'error' }) } finally { setPicBusy(false) }
  }
  const removePic = async () => { setPicBusy(true); try { await mfetch('/api/me/avatar', { method: 'DELETE' }); await loadMe(); toast('Profile picture removed', { tone: 'info' }) } finally { setPicBusy(false) } }
  const F = ({ id, label, error, hint, children }) => <div className={`pf-field${error ? ' has-error' : ''}`}><label htmlFor={id}>{label}</label>{children}{hint && !error && <p className="mb-hint">{hint}</p>}{error && <p className="mb-err" role="alert">{error}</p>}</div>

  return (
    <Dialog open={open} onClose={onClose} title="Edit profile" description="Only you can change these. Your email and phone number are not shown here.">
      <form onSubmit={save} className="pf-form" noValidate>
        <div className="pf-picrow">
          <Avatar user={user} size="xl" />
          <div>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
            <button type="button" className="cm-btn cm-btn--ghost is-sm" disabled={picBusy} onClick={() => file.current?.click()}>{picBusy && <Spinner />}{user.avatarUrl ? 'Change picture' : 'Upload picture'}</button>
            {user.avatarUrl && <button type="button" className="cm-ghost" disabled={picBusy} onClick={removePic}>Remove</button>}
            <p className="mb-hint">PNG, JPEG or WebP. It is resized to a small square.</p>
          </div>
        </div>
        <F id="pf-name" label="Full name" error={errors.name}><input id="pf-name" value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></F>
        <F id="pf-user" label="Username" error={errors.username} hint="Optional. 3 to 30 lowercase letters, numbers or underscores."><input id="pf-user" value={form.username} onChange={(e) => set({ username: e.target.value })} autoCapitalize="none" /></F>
        <F id="pf-head" label="Professional headline" error={errors.headline}><input id="pf-head" value={form.headline} maxLength={80} onChange={(e) => set({ headline: e.target.value })} placeholder="e.g. ML engineer building retrieval systems" /></F>
        <F id="pf-bio" label="Bio" error={errors.bio} hint={`${form.bio.length}/300`}><textarea id="pf-bio" rows={3} maxLength={300} value={form.bio} onChange={(e) => set({ bio: e.target.value })} /></F>
        <F id="pf-loc" label="Location (optional)" error={errors.location} hint="Only shown if you turn on “Show location” in settings."><input id="pf-loc" value={form.location} onChange={(e) => set({ location: e.target.value })} /></F>
        <F id="pf-int" label="Technology interests" error={errors.interests} hint="Separate with commas. Up to 12."><input id="pf-int" value={form.interests} onChange={(e) => set({ interests: e.target.value })} /></F>
        <F id="pf-skills" label="Skills" error={errors.skills} hint="Separate with commas. Up to 15."><input id="pf-skills" value={form.skills} onChange={(e) => set({ skills: e.target.value })} /></F>
        <fieldset className="pf-links"><legend>Website or professional links (up to 3, https only)</legend>
          {form.links.map((l, i) => (
            <div key={i}><input aria-label={`Link ${i + 1} label`} placeholder="Label" value={l.label} maxLength={30} onChange={(e) => set({ links: form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input aria-label={`Link ${i + 1} address`} placeholder="https://…" value={l.url} onChange={(e) => set({ links: form.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} /></div>
          ))}
          {errors.links && <p className="mb-err" role="alert">{errors.links}</p>}
        </fieldset>
        {errors.form && !Object.keys(errors).some((k) => k !== 'form') && <p className="mb-err" role="alert">{errors.form}</p>}
        <div className="cm-dialog__row"><button type="button" className="cm-ghost" onClick={onClose}>Cancel</button><button type="submit" className="cm-btn cm-btn--primary" disabled={busy || form.name.trim().length < 2}>{busy && <Spinner />}Save profile</button></div>
      </form>
    </Dialog>
  )
}
