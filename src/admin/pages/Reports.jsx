import { useState } from 'react'
import { download } from '../api'
import { useAuth } from '../auth'
import { Button, Empty, ErrorState, Loading, PageHead, Table, label, useList, useToast } from '../ui'

const Counts = ({ title, map }) => map && (
  <section className="a-card"><h2>{title}</h2>{Object.keys(map).length ? <ul className="a-list">{Object.entries(map).map(([k, v]) => <li key={k}><span>{label(k)}</span><b>{v}</b></li>)}</ul> : <Empty title="No data yet" />}</section>
)

export default function Reports() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useList('/reports/summary')
  const [busy, setBusy] = useState('')
  const exp = async (type) => { setBusy(type); try { await download(`/reports/export/${type}`, `${type}.csv`); toast(`${label(type)} exported. This was recorded in the audit log.`) } catch (e) { toast(e.message, 'bad') } finally { setBusy('') } }
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} retry={reload} />
  return (
    <>
      <PageHead title="Reports" sub="Figures computed from live records." actions={can('reports.export') && <>
        {can('users.read') && <Button busy={busy === 'users'} onClick={() => exp('users')}>Export users</Button>}
        {can('registrations.read') && <Button busy={busy === 'registrations'} onClick={() => exp('registrations')}>Export registrations</Button>}
        {can('enquiries.read') && <Button busy={busy === 'enquiries'} onClick={() => exp('enquiries')}>Export enquiries</Button>}</>} />
      <div className="a-grid2">
        <Counts title="Projects by status" map={data.projectsByStatus} /><Counts title="Events by status" map={data.eventsByStatus} /><Counts title="Enquiries by status" map={data.enquiriesByStatus} />
        {data.usersByRole && <section className="a-card"><h2>Users by role</h2><ul className="a-list">{data.usersByRole.map((r) => <li key={r.role}><span>{r.role}</span><b>{r.users}</b></li>)}</ul></section>}
        {data.registrationsPerEvent && <section className="a-card"><h2>Registrations per event</h2>{data.registrationsPerEvent.length ? <Table rows={data.registrationsPerEvent} columns={[{ key: 't', title: 'Event', render: (e) => e.title }, { key: 'r', title: 'Registered', render: (e) => `${e.registered}${e.capacity ? ` / ${e.capacity}` : ''}` }]} /> : <Empty title="No registrations yet" />}</section>}
      </div>
    </>
  )
}
