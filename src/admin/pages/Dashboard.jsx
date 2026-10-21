// Overview. Every number comes from GET /api/admin/dashboard; sections the user cannot read are simply absent.
import { useState } from 'react'
import { Badge, Empty, ErrorState, Loading, PageHead, Table, fmtDate, label, useList } from '../ui'
import { Link } from '../router'
import { useAuth } from '../auth'
import { ALL_ITEMS } from '../nav'

const Stat = ({ title, value, note, to }) => (
  <div className="a-stat">{to ? <Link to={to}><p>{title}</p></Link> : <p>{title}</p>}<strong>{value}</strong>{note && <small className="a-muted">{note}</small>}</div>
)

export default function Dashboard() {
  const { can, user } = useAuth()
  const [days, setDays] = useState(30)
  const { data, loading, error, reload } = useList('/dashboard', { days })
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} retry={reload} />
  const { users, communities, cohorts, events, projects, enquiries, pending, activity } = data
  const perDay = users ? Object.entries(users.perDay).sort() : []
  const max = Math.max(1, ...perDay.map(([, n]) => n))
  const quick = ALL_ITEMS.filter((i) => i.perm && can(i.perm) && i.path !== '/admin').slice(0, 6)

  return (
    <>
      <PageHead title={`Welcome, ${user.name.split(' ')[0]}`} sub="A live summary of the platform." actions={
        <label className="a-inline">Range <select className="a-input" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>} />
      <div className="a-stats">
        {users && <><Stat title="Registered users" value={users.total} to="/admin/users" /><Stat title="Active accounts" value={users.active} note={`${users.suspended} suspended`} /><Stat title={`New in ${days} days`} value={users.newInRange} /></>}
        {communities && <Stat title="Published communities" value={communities.published} note={`${communities.total} in total`} to="/admin/communities" />}
        {cohorts && <Stat title="Published cohorts" value={cohorts.published} note={`${cohorts.total} in total`} to="/admin/cohorts" />}
        {events && <><Stat title="Upcoming events" value={events.upcoming} to="/admin/events" /><Stat title="Open registrations" value={events.openRegistrations} note={`${events.registrations} people registered`} /></>}
        {projects && <><Stat title="Published projects" value={projects.published} to="/admin/projects" /><Stat title="Under development" value={projects.underDevelopment} note={`${projects.marketReady} market ready`} /></>}
        {enquiries && <Stat title="Open enquiries" value={enquiries.open} note={`${enquiries.new} new`} to="/admin/enquiries" />}
      </div>

      <div className="a-grid2">
        {users && (
          <section className="a-card"><h2>New registrations</h2>
            {perDay.length ? <ul className="a-bars" aria-label="New registrations per day">{perDay.map(([d, n]) => <li key={d}><span>{new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span><i style={{ width: `${(n / max) * 100}%` }} /><b>{n}</b></li>)}</ul>
              : <Empty title="No new registrations in this range" />}
          </section>)}
        {events && (
          <section className="a-card"><h2>Upcoming events</h2>
            {events.next.length ? <Table columns={[{ key: 't', title: 'Event', render: (e) => e.title }, { key: 'd', title: 'Starts', render: (e) => fmtDate(e.startDateTime) }, { key: 'r', title: 'Registered', render: (e) => `${e.registered}${e.capacity ? ` / ${e.capacity}` : ''}` }, { key: 's', title: 'Status', render: (e) => <Badge value={e.status} /> }]} rows={events.next} />
              : <Empty title="No upcoming events" />}
          </section>)}
        <section className="a-card"><h2>Waiting for review</h2>
          {pending.length ? <ul className="a-list">{pending.map((p) => <li key={p.type + p.id}><Link to={p.link}>{p.title}</Link><span className="a-muted">{p.note}</span></li>)}</ul> : <Empty title="Nothing is waiting" body="Projects under review and unpublished content drafts appear here." />}
        </section>
        {activity && (
          <section className="a-card"><h2>Recent activity</h2>
            {activity.length ? <ul className="a-list">{activity.map((a) => <li key={a.id}><span>{label(a.action)}<small className="a-muted"> by {a.actorEmail ?? 'system'}</small></span><span className="a-muted">{fmtDate(a.at)}</span></li>)}</ul> : <Empty title="No activity yet" />}
          </section>)}
      </div>
      {quick.length > 0 && <section className="a-card"><h2>Quick actions</h2><div className="a-quick">{quick.map((i) => <Link key={i.path} to={i.path} className="a-btn">{i.label}</Link>)}</div></section>}
    </>
  )
}
