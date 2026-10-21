// Small helpers shared by the profile sections: data loading, avatar, dates.
import { useCallback, useEffect, useState } from 'react'
import { mfetch } from '../member/session'

export function useFetch(path, enabled = true) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    mfetch(path).then((data) => live && setState({ loading: false, error: null, data })).catch((error) => live && setState({ loading: false, error, data: null }))
    return () => { live = false }
  }, [path, tick, enabled])
  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) }
}

export const initials = (name = '') => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

export function Avatar({ user, size = 'lg' }) {
  return user?.avatarUrl
    ? <img className={`pf-avatar pf-avatar--${size}`} src={user.avatarUrl} alt={`${user.name}’s profile picture`} />
    : <span className={`pf-avatar pf-avatar--${size}`} role="img" aria-label={`${user?.name ?? 'Member'}, no profile picture`}>{initials(user?.name)}</span>
}

export const when = (iso, tz) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: tz || undefined, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: tz ? 'short' : undefined }) : '')
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const minutesBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 60000)
export const duration = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`)

export const Skeleton = ({ rows = 3 }) => <div className="pf-skel" aria-hidden="true">{Array.from({ length: rows }, (_, i) => <span key={i} />)}</div>
export const Empty = ({ title, body, action }) => <div className="pf-empty"><h3>{title}</h3>{body && <p>{body}</p>}{action}</div>
export const Failed = ({ error, retry }) => <div className="pf-empty pf-empty--bad" role="alert"><h3>Could not load this</h3><p>{error?.message}</p>{retry && <button type="button" className="mb-btn" onClick={retry}>Try again</button>}</div>
