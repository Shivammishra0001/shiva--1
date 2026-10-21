// The four profile sections: My Communities, My Cohorts & Events, My Activity and Settings.
// Everything here is read from the server (the signed-in member's own records); nothing is invented in the browser.
import { useMemo, useState } from 'react'
import { cohorts as cohortData, communities as communityData } from '../data/communities'
import { art } from '../components/community/Events'
import { Dialog, Logo, Spinner } from '../components/community/ui'
import { api, toast, useAllEvents } from '../lib/community'
import { MemberError, loadMe, mfetch, signOut } from '../member/session'
import { Empty, Failed, Skeleton, day, duration, minutesBetween, useFetch, when } from './shared'

const bySlug = (list, slug) => list.find((c) => c.slug === slug)

/* ---------- My Communities ---------- */
export function MyCommunities({ part }) {
  const { data: events } = useAllEvents()
  const [leaving, setLeaving] = useState(null)
  const [busy, setBusy] = useState(false)
  const leave = async () => {
    setBusy(true)
    try { await api.leave(leaving.slug); toast(`You left ${leaving.name}`, { tone: 'info' }); setLeaving(null); part.reload() } catch (e) { toast(e.message, { tone: 'error' }) } finally { setBusy(false) }
  }
  if (part.loading && !part.data) return <Skeleton rows={3} />
  if (part.error) return <Failed error={part.error} retry={part.reload} />
  const list = part.data.communities
  if (!list.length) return <Empty title="You haven’t joined a community yet" body="Communities are where you ask questions, share what you build and meet people working on the same things." action={<a className="mb-btn mb-btn--link" href="/community.html">Explore communities</a>} />
  return (
    <>
      <ul className="pf-cards">
        {list.map((m) => {
          const c = bySlug(communityData, m.slug)
          const upcoming = (events ?? []).filter((e) => e.upcoming && e.communities.includes(m.slug)).slice(0, 2)
          return (
            <li key={m.slug} className="pf-card">
              <div className="pf-card__head">{c && <Logo community={c} size="md" decorative />}<div><h3>{m.name}</h3><span className="pf-badge">Member</span></div></div>
              <p className="pf-muted">{c?.tagline ?? ''}</p>
              <p className="pf-meta">Joined {day(m.joinedAt)}</p>
              {!m.available && <p className="pf-note">This community is not currently available.</p>}
              {upcoming.length > 0 && <div><p className="pf-kicker">Upcoming events</p><ul className="pf-mini">{upcoming.map((e) => <li key={e.slug}><a href={`/community.html?event=${e.slug}`}>{e.title}</a><span>{day(e.startDateTime)}</span></li>)}</ul></div>}
              <div className="pf-actions">{m.available && <a className="mb-btn mb-btn--link" href={`/community.html?c=${m.slug}`}>View community</a>}<button type="button" className="mb-link" onClick={() => setLeaving(m)}>Leave</button></div>
            </li>
          )
        })}
      </ul>
      <Dialog open={!!leaving} onClose={() => setLeaving(null)} title={`Leave ${leaving?.name}?`} description="You can join again at any time. Your posts stay where they are.">
        <div className="cm-dialog__row"><button type="button" className="cm-ghost" onClick={() => setLeaving(null)}>Stay</button><button type="button" className="cm-btn cm-btn--primary" disabled={busy} onClick={leave}>{busy && <Spinner />}Leave community</button></div>
      </Dialog>
    </>
  )
}

/* ---------- My Cohorts & Events ---------- */
function EventCard({ e, assoc, onCancel }) {
  const mins = e.startDateTime && e.endDateTime ? minutesBetween(e.startDateTime, e.endDateTime) : null
  const upcoming = e.startDateTime && Date.parse(e.startDateTime) > Date.now()
  const cancellable = upcoming && e.status === 'registered' && e.eventStatus !== 'cancelled'
  return (
    <li className="pf-card pf-event">
      {e.category && <div className="pf-cover" style={art(e)} aria-hidden="true" />}
      <h3>{e.title}</h3>
      <p className="pf-meta">{e.startDateTime ? when(e.startDateTime, e.timeZone) : 'Date to be confirmed'}{mins ? ` · ${duration(mins)}` : ''}{e.format ? ` · ${e.format}` : ''}</p>
      {e.host && <p className="pf-muted">Hosted by {e.host}</p>}
      <p><span className={`pf-badge pf-badge--${e.status}`}>{e.status === 'registered' ? 'Registered' : e.status === 'attended' ? 'Attended' : e.status === 'cancelled' ? 'Cancelled' : e.status}</span>{e.eventStatus === 'cancelled' && <span className="pf-badge pf-badge--cancelled">Event cancelled</span>}</p>
      {assoc.length > 0 && <p className="pf-meta">Related: {assoc.join(', ')}</p>}
      <div className="pf-actions">{e.slug && e.available && <a className="mb-btn mb-btn--link" href={`/community.html?event=${e.slug}`}>View details</a>}{cancellable && <button type="button" className="mb-link" onClick={() => onCancel(e)}>Cancel registration</button>}</div>
    </li>
  )
}

export function MyEvents({ part }) {
  const { data: all } = useAllEvents()
  const [cancel, setCancel] = useState(null)
  const [withdraw, setWithdraw] = useState(null)
  const [busy, setBusy] = useState(false)
  const assocOf = (slug) => (all?.find((x) => x.slug === slug)?.communities ?? []).map((s) => bySlug(communityData, s)?.name).filter(Boolean)
  const groups = useMemo(() => {
    const ev = part.data?.events ?? []
    const now = Date.now()
    const live = ev.filter((e) => e.status !== 'cancelled')
    return {
      upcoming: live.filter((e) => e.startDateTime && Date.parse(e.endDateTime ?? e.startDateTime) > now && e.eventStatus !== 'cancelled').sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)),
      past: live.filter((e) => !e.startDateTime || Date.parse(e.endDateTime ?? e.startDateTime) <= now).sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime)),
      cancelled: ev.filter((e) => e.status === 'cancelled' || e.eventStatus === 'cancelled'),
    }
  }, [part.data])
  const run = async (fn, msg, done) => { setBusy(true); try { await fn(); toast(msg, { tone: 'info' }); done(); part.reload() } catch (e) { toast(e.message, { tone: 'error' }) } finally { setBusy(false) } }
  if (part.loading && !part.data) return <Skeleton rows={3} />
  if (part.error) return <Failed error={part.error} retry={part.reload} />
  const active = part.data.cohorts.filter((c) => c.status === 'enrolled')
  const withdrawn = part.data.cohorts.filter((c) => c.status === 'withdrawn')
  const none = !part.data.cohorts.length && !part.data.events.length
  if (none) return <Empty title="No cohorts or events yet" body="Enrol in a cohort or register for an event and it will show up here." action={<span className="pf-actions"><a className="mb-btn mb-btn--link" href="/cohort.html">Explore cohorts</a><a className="mb-link" href="/community.html#events">Browse events</a></span>} />
  return (
    <>
      <h3 className="pf-h">Active cohorts</h3>
      {active.length ? <ul className="pf-cards">{active.map((c) => { const d = bySlug(cohortData, c.slug); return (
        <li key={c.slug} className="pf-card"><div className="pf-card__head">{d && <Logo community={d} size="md" decorative />}<div><h3>{c.name}</h3><span className="pf-badge">Enrolled</span></div></div><p className="pf-muted">{d?.tagline}</p><p className="pf-meta">Enrolled {day(c.enrolledAt)}</p>{!c.available && <p className="pf-note">This cohort is not currently available.</p>}
          <div className="pf-actions">{c.available && <a className="mb-btn mb-btn--link" href={`/cohort.html?c=${c.slug}`}>View details</a>}<button type="button" className="mb-link" onClick={() => setWithdraw(c)}>Withdraw</button></div></li>) })}</ul>
        : <p className="pf-muted">You aren’t enrolled in a cohort. <a href="/cohort.html">Explore cohorts</a>.</p>}
      <h3 className="pf-h">Upcoming events</h3>
      {groups.upcoming.length ? <ul className="pf-cards">{groups.upcoming.map((e) => <EventCard key={e.slug ?? e.registeredAt} e={e} assoc={assocOf(e.slug)} onCancel={setCancel} />)}</ul> : <p className="pf-muted">No upcoming events. Registrations you make appear here.</p>}
      <h3 className="pf-h">Past events</h3>
      {groups.past.length ? <ul className="pf-cards">{groups.past.map((e) => <EventCard key={e.slug ?? e.registeredAt} e={e} assoc={assocOf(e.slug)} onCancel={setCancel} />)}</ul> : <p className="pf-muted">Events you registered for that have finished appear here.</p>}
      {(groups.cancelled.length > 0 || withdrawn.length > 0) && (
        <><h3 className="pf-h">Cancelled or withdrawn</h3>
          <ul className="pf-cards">{groups.cancelled.map((e) => <EventCard key={`c-${e.slug}`} e={e} assoc={assocOf(e.slug)} onCancel={setCancel} />)}
            {withdrawn.map((c) => <li key={`w-${c.slug}`} className="pf-card"><h3>{c.name}</h3><p><span className="pf-badge pf-badge--cancelled">Withdrawn</span></p><p className="pf-meta">Withdrew {day(c.withdrawnAt)}</p>{c.available && <div className="pf-actions"><a className="mb-btn mb-btn--link" href={`/cohort.html?c=${c.slug}`}>View details</a></div>}</li>)}</ul></>)}
      <Dialog open={!!cancel} onClose={() => setCancel(null)} title="Cancel this registration?" description={cancel ? `${cancel.title}. Your seat is released for someone else.` : undefined}>
        <div className="cm-dialog__row"><button type="button" className="cm-ghost" onClick={() => setCancel(null)}>Keep it</button><button type="button" className="cm-btn cm-btn--primary" disabled={busy} onClick={() => run(() => api.cancelRegistration(cancel.slug), 'Registration cancelled', () => setCancel(null))}>{busy && <Spinner />}Cancel registration</button></div>
      </Dialog>
      <Dialog open={!!withdraw} onClose={() => setWithdraw(null)} title={`Withdraw from ${withdraw?.name}?`} description="You can enrol again later.">
        <div className="cm-dialog__row"><button type="button" className="cm-ghost" onClick={() => setWithdraw(null)}>Stay enrolled</button><button type="button" className="cm-btn cm-btn--primary" disabled={busy} onClick={() => run(() => api.withdraw(withdraw.slug), 'You withdrew from the cohort', () => setWithdraw(null))}>{busy && <Spinner />}Withdraw</button></div>
      </Dialog>
    </>
  )
}

/* ---------- My Activity ---------- */
const TEXT = {
  community_joined: (a) => `Joined the ${a.resource?.title} community`,
  community_left: (a) => `Left the ${a.resource?.title} community`,
  cohort_enrolled: (a) => `Enrolled in the ${a.resource?.title} cohort`,
  cohort_withdrawn: (a) => `Withdrew from the ${a.resource?.title} cohort`,
  event_registered: (a) => `Registered for ${a.resource?.title}`,
  event_cancelled: (a) => `Cancelled the registration for ${a.resource?.title}`,
  post_created: (a) => `${a.held ? 'Wrote a post (awaiting review)' : 'Published a post'} in ${a.resource?.title}`,
  comment_created: (a) => `${a.held ? 'Wrote a comment (awaiting review)' : 'Commented'} in ${a.resource?.title}`,
  profile_updated: (a) => `Updated your profile${a.fields?.length ? ` (${a.fields.join(', ')})` : ''}`,
  moderation_notice: (a) => `Moderation notice: ${a.text}`,
}

export function MyActivity() {
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const { data, loading, error, reload } = useFetch(`/api/me/activity?page=${page}&pageSize=15`)
  const merged = useMemo(() => { const seen = new Set(); return [...items, ...(data?.items ?? [])].filter((a) => !seen.has(a.id) && seen.add(a.id)) }, [items, data])
  if (error) return <Failed error={error} retry={reload} />
  if (loading && !merged.length) return <Skeleton rows={5} />
  if (!merged.length) return <Empty title="No activity yet" body="When you join a community, enrol, register for an event or post, it will be listed here." />
  return (
    <>
      <ol className="pf-feed">{merged.map((a) => (
        <li key={a.id}><span className="pf-dot" aria-hidden="true" /><div><p>{(TEXT[a.type] ?? (() => a.type))(a)}</p><p className="pf-meta"><time dateTime={a.at}>{when(a.at)}</time>{a.resource?.link && a.type !== 'profile_updated' && <> · <a href={a.resource.link}>View</a></>}</p></div></li>
      ))}</ol>
      {data && page < data.pages && <button type="button" className="mb-btn mb-btn--link" disabled={loading} onClick={() => { setItems(merged); setPage(page + 1) }}>{loading && <Spinner />}Load more</button>}
    </>
  )
}

/* ---------- Settings ---------- */
const Toggle = ({ id, label, hint, checked, onChange }) => <label className="pf-toggle" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span><b>{label}</b>{hint && <small>{hint}</small>}</span></label>

export function Settings({ user }) {
  const [s, setS] = useState(user.settings)
  const [saved, setSaved] = useState('')
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const [pwErr, setPwErr] = useState({})
  const [deactivate, setDeactivate] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const update = async (patch) => {
    const next = { ...s, ...patch }; setS(next); setSaved('')
    try { await mfetch('/api/me/settings', { method: 'PATCH', body: patch }); await loadMe(); setSaved('Saved') } catch (e) { setS(s); toast(e.message, { tone: 'error' }) }
  }
  const changePw = async (e) => {
    e.preventDefault(); setBusy(true); setPwErr({})
    try { await mfetch('/api/auth/change-password', { method: 'POST', body: pw }); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed. Other devices were signed out.') } catch (err) { setPwErr(err instanceof MemberError ? { ...err.details, form: err.message } : { form: 'Something went wrong.' }) } finally { setBusy(false) }
  }
  const requestDeactivation = async () => { setBusy(true); try { const r = await mfetch('/api/me/deactivation-request', { method: 'POST', body: { reason } }); toast(r.message, { tone: 'info' }); setDeactivate(false) } catch (e) { toast(e.message, { tone: 'error' }) } finally { setBusy(false) } }
  return (
    <div className="pf-settings">
      <section className="pf-block" aria-labelledby="st-priv"><h3 id="st-priv">Privacy</h3>
        <div className="pf-field"><label htmlFor="st-vis">Who can see your profile</label>
          <select id="st-vis" value={s.visibility} onChange={(e) => update({ visibility: e.target.value })}><option value="private">Only me</option><option value="members">Signed-in members</option><option value="public">Anyone</option></select>
          <p className="mb-hint">Your phone number is never shown. Your email is shown only if you turn it on below.</p></div>
        <Toggle id="st-int" label="Show my interests" checked={s.showInterests} onChange={(v) => update({ showInterests: v })} />
        <Toggle id="st-com" label="Show the communities I joined" checked={s.showCommunities} onChange={(v) => update({ showCommunities: v })} />
        <Toggle id="st-loc" label="Show my location" checked={s.showLocation} onChange={(v) => update({ showLocation: v })} />
        <Toggle id="st-mail" label="Show my email to signed-in members" hint="Off by default." checked={s.showEmail} onChange={(v) => update({ showEmail: v })} />
        <p className="pf-meta" role="status">{saved}</p>
      </section>
      <section className="pf-block" aria-labelledby="st-not"><h3 id="st-not">Notifications</h3>
        <Toggle id="st-ne" label="Email me about my account" checked={s.notifyEmail} onChange={(v) => update({ notifyEmail: v })} />
        <Toggle id="st-nv" label="Email me about events I registered for" checked={s.notifyEvents} onChange={(v) => update({ notifyEvents: v })} />
        <p className="mb-hint">These choices are saved, but email is not connected yet, so nothing is sent for now.</p>
      </section>
      <section className="pf-block" aria-labelledby="st-sec"><h3 id="st-sec">Account security</h3>
        <form onSubmit={changePw} className="pf-form" noValidate>
          <div className={`pf-field${pwErr.currentPassword ? ' has-error' : ''}`}><label htmlFor="st-cur">Current password</label><input id="st-cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />{pwErr.currentPassword && <p className="mb-err" role="alert">{pwErr.currentPassword}</p>}</div>
          <div className={`pf-field${pwErr.newPassword ? ' has-error' : ''}`}><label htmlFor="st-new">New password</label><input id="st-new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /><p className="mb-hint">At least 12 characters, with upper and lower case letters and a number.</p>{pwErr.newPassword && <p className="mb-err" role="alert">{pwErr.newPassword}</p>}</div>
          {pwErr.form && !pwErr.currentPassword && !pwErr.newPassword && <p className="mb-err" role="alert">{pwErr.form}</p>}
          <button type="submit" className="mb-btn" disabled={busy || !pw.currentPassword || !pw.newPassword}>{busy && <Spinner />}Change password</button>
        </form>
        <p className="pf-actions"><button type="button" className="mb-link" onClick={signOut}>Sign out</button></p>
      </section>
      <section className="pf-block" aria-labelledby="st-del"><h3 id="st-del">Deactivate your account</h3>
        <p className="pf-muted">Send a request to our team. Your account stays active until they follow up.</p>
        <button type="button" className="mb-link" onClick={() => setDeactivate(true)}>Request deactivation</button>
      </section>
      <Dialog open={deactivate} onClose={() => setDeactivate(false)} title="Request account deactivation?" description="We will contact you by email before anything changes.">
        <div className="pf-field"><label htmlFor="st-r">Reason (optional)</label><textarea id="st-r" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div className="cm-dialog__row"><button type="button" className="cm-ghost" onClick={() => setDeactivate(false)}>Not now</button><button type="button" className="cm-btn cm-btn--primary" disabled={busy} onClick={requestDeactivation}>{busy && <Spinner />}Send request</button></div>
      </Dialog>
    </div>
  )
}
