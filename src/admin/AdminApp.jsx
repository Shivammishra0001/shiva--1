// Auth gate + route table. Pages live in ./pages; the sidebar comes from ./nav.js.
import { AuthProvider, useAuth } from './auth'
import { ToastProvider, Loading, Denied } from './ui'
import { usePath } from './router'
import Shell from './Shell'
import { ALL_ITEMS } from './nav'
import Login from './pages/Login'
import { ChangePassword } from './pages/Account'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Roles from './pages/Roles'
import { Communities, Cohorts, Events, Projects } from './pages/Resources'
import Content from './pages/Content'
import Enquiries from './pages/Enquiries'
import Moderation from './pages/Moderation'
import Reports from './pages/Reports'
import AuditLogs from './pages/AuditLogs'
import Settings from './pages/Settings'

const PAGES = {
  '/admin': Dashboard, '/admin/users': Users, '/admin/roles': Roles, '/admin/communities': Communities, '/admin/cohorts': Cohorts,
  '/admin/events': Events, '/admin/projects': Projects, '/admin/content': Content, '/admin/enquiries': Enquiries, '/admin/moderation': Moderation,
  '/admin/reports': Reports, '/admin/audit-logs': AuditLogs, '/admin/settings': Settings, '/admin/account': ChangePassword,
}

function Routes() {
  const { loading, user, can, signOut } = useAuth()
  const path = usePath()
  if (loading) return <Loading text="Checking your session" />
  if (!user) return <Login />
  if (user.mustChangePassword) return <ChangePassword forced />
  if (!user.permissions.length) {
    return (
      <div className="a-login"><div className="a-login__card"><h1>No admin access</h1><p className="a-muted">You are signed in as {user.email}, but this account is not an admin account.</p>
        <button type="button" className="a-btn a-btn--primary" onClick={signOut}>Sign out and use an admin account</button><a className="a-muted a-login__back" href="/">← Back to the public site</a></div></div>
    )
  }
  const Page = PAGES[path]
  const item = ALL_ITEMS.find((i) => i.path === path)
  return (
    <Shell path={path}>
      {!Page ? <div className="a-state"><h3>Page not found</h3><p className="a-muted">Use the menu to find what you need.</p></div>
        : item?.perm && !can(item.perm) ? <Denied /> : <Page />}
    </Shell>
  )
}

export default function AdminApp() {
  return <AuthProvider><ToastProvider><Routes /></ToastProvider></AuthProvider>
}
