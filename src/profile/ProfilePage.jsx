// The signed-in member's own profile (profile.html), and another member's public profile (profile.html?u=<id>).
import { useEffect, useState } from 'react'
import { ToastHost } from '../components/community/ui'
import { signOut, useMember } from '../member/session'
import EditProfile from './EditProfile'
import { MyActivity, MyCommunities, MyEvents, Settings } from './Sections'
import { Avatar, Failed, Skeleton, day, useFetch } from './shared'

const TABS = [['communities', 'My communities'], ['events', 'Cohorts & events'], ['activity', 'Activity'], ['settings', 'Settings']]

export function OwnProfile() {
  const { user } = useMember()
  const [tab, setTab] = useState(() => (TABS.some(([id]) => id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'communities'))
  const [editing, setEditing] = useState(false)
  const part = useFetch('/api/me/participation')
  const go = (id) => { setTab(id); window.history.replaceState(null, '', `#${id}`) }
  // Back/forward and edits to the #section in the address bar switch tabs too.
  useEffect(() => {
    const onHash = () => { const h = window.location.hash.slice(1); if (TABS.some(([id]) => id === h)) setTab(h) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    const i = TABS.findIndex(([id]) => id === tab); const next = TABS[(i + d + TABS.length) % TABS.length][0]
    go(next); setTimeout(() => document.getElementById(`pt-${next}`)?.focus(), 0)
  }
  return (
    <div className="pf">
      <header className="pf-head">
        <Avatar user={user} size="xl" />
        <div className="pf-head__main">
          <h1>{user.name}</h1>
          <p className="pf-sub">{user.username && <span>@{user.username}</span>}{user.emailVerified && <span className="pf-verified" title="Email verified">✓ Verified email</span>}</p>
          {user.headline && <p className="pf-headline">{user.headline}</p>}
          {user.bio && <p className={user.bioStatus !== 'published' ? 'pf-muted' : undefined}>{user.bio}{user.bioStatus !== 'published' && ' (awaiting review, only you can see this)'}</p>}
          {(user.interests.length > 0 || user.skills.length > 0) && <ul className="pf-chips" aria-label="Interests and skills">{[...user.interests, ...user.skills].map((x) => <li key={x}>{x}</li>)}</ul>}
          {user.links.length > 0 && <p className="pf-links">{user.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.label}</a>)}</p>}
          <p className="pf-meta">{user.location && `${user.location} · `}Member since {day(user.createdAt)}</p>
        </div>
        <div className="pf-head__act"><button type="button" className="mb-btn" onClick={() => setEditing(true)}>Edit profile</button><button type="button" className="mb-link" onClick={signOut}>Sign out</button></div>
      </header>
      <div className="pf-tabs" role="tablist" aria-label="Profile sections" onKeyDown={onKey}>
        {TABS.map(([id, name]) => <button key={id} id={`pt-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="pf-panel" tabIndex={tab === id ? 0 : -1} className={tab === id ? 'is-on' : ''} onClick={() => go(id)}>{name}</button>)}
      </div>
      <section id="pf-panel" role="tabpanel" aria-labelledby={`pt-${tab}`} className="pf-panel">
        {tab === 'communities' && <MyCommunities part={part} />}
        {tab === 'events' && <MyEvents part={part} />}
        {tab === 'activity' && <MyActivity />}
        {tab === 'settings' && <Settings user={user} />}
      </section>
      {editing && <EditProfile key={user.name + user.headline} user={user} open onClose={() => setEditing(false)} />}
      <ToastHost />
    </div>
  )
}

export function PublicProfile({ id }) {
  const { data, loading, error } = useFetch(`/api/members/${id}`)
  if (loading) return <div className="pf"><Skeleton rows={4} /></div>
  if (error) return <div className="pf"><Failed error={{ message: 'This profile is private or does not exist.' }} /></div>
  const p = data.profile
  return (
    <div className="pf"><header className="pf-head"><Avatar user={p} size="xl" /><div className="pf-head__main"><h1>{p.name}</h1>{p.username && <p className="pf-sub">@{p.username}</p>}{p.headline && <p className="pf-headline">{p.headline}</p>}{p.bio && <p>{p.bio}</p>}
      {(p.skills.length > 0 || p.interests?.length > 0) && <ul className="pf-chips">{[...(p.interests ?? []), ...p.skills].map((x) => <li key={x}>{x}</li>)}</ul>}
      {p.links.length > 0 && <p className="pf-links">{p.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.label}</a>)}</p>}
      <p className="pf-meta">{p.location && `${p.location} · `}Member since {day(p.memberSince)}</p>
      {p.communities?.length > 0 && <p className="pf-meta">Communities: {p.communities.map((c) => c.name).join(', ')}</p>}
      {p.email && <p className="pf-meta">Email: {p.email}</p>}</div></header></div>
  )
}
