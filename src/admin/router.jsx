// A tiny history router (the admin has a handful of flat routes, so no library is needed).
import { useSyncExternalStore } from 'react'

const subscribe = (fn) => { window.addEventListener('popstate', fn); window.addEventListener('admin:nav', fn); return () => { window.removeEventListener('popstate', fn); window.removeEventListener('admin:nav', fn) } }
export const usePath = () => useSyncExternalStore(subscribe, () => window.location.pathname.replace(/\/$/, '') || '/admin', () => '/admin')

export function navigate(to, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
  window.dispatchEvent(new Event('admin:nav'))
  window.scrollTo({ top: 0 })
}

export function Link({ to, children, onClick, ...rest }) {
  return <a href={to} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onClick?.(); navigate(to) }} {...rest}>{children}</a>
}
