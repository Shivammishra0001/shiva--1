// Application shell: permission-filtered sidebar, top bar with breadcrumbs and account menu.
import { useEffect, useState } from 'react'
import { useAuth } from './auth'
import { NAV, ALL_ITEMS } from './nav'
import { Link } from './router'
import { Icon } from './ui'

export default function Shell({ path, children }) {
  const { user, can, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const current = ALL_ITEMS.find((i) => i.path === path)
  useEffect(() => { setOpen(false); setMenu(false) }, [path])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setMenu(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length)

  return (
    <div className="a-shell">
      <a className="a-skip" href="#a-main">Skip to content</a>
      <aside id="a-side" className={`a-side${open ? ' is-open' : ''}`} aria-label="Admin navigation">
        <Link to="/admin" className="a-brand"><img src="/logo-96.png" alt="" width="36" height="36" /><span>Co-Working<small>Admin</small></span></Link>
        <nav>
          {groups.map((g) => (
            <div key={g.group} className="a-navgroup">
              <p>{g.group}</p>
              {g.items.map((i) => <Link key={i.path} to={i.path} className={path === i.path ? 'is-on' : undefined} aria-current={path === i.path ? 'page' : undefined}><Icon d={i.icon} /><span>{i.label}</span></Link>)}
            </div>
          ))}
        </nav>
        <a className="a-site" href="/">← View public site</a>
      </aside>
      {open && <button type="button" className="a-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <div className="a-main">
        <header className="a-top">
          <button type="button" className="a-icon-btn a-burger" aria-expanded={open} aria-controls="a-side" aria-label="Open menu" onClick={() => setOpen(true)}><Icon d="M4 7h16M4 12h16M4 17h16" /></button>
          <nav className="a-crumbs" aria-label="Breadcrumb"><Link to="/admin">Admin</Link>{current && path !== '/admin' && <><span aria-hidden="true">/</span><span aria-current="page">{current.label}</span></>}{path === '/admin/account' && <><span aria-hidden="true">/</span><span aria-current="page">Account</span></>}</nav>
          <div className="a-account">
            <button type="button" className="a-user" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((v) => !v)}>
              <span className="a-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="a-user__text"><b>{user.name}</b><small>{user.roles.map((r) => r.name).join(', ') || 'No role'}</small></span>
            </button>
            {menu && (
              <div className="a-menu" role="menu">
                <p className="a-muted a-menu__mail">{user.email}</p>
                <Link to="/admin/account" role="menuitem">Change password</Link>
                <button type="button" role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main id="a-main" className="a-content">{children}</main>
      </div>
    </div>
  )
}
