// Website content blocks: edit a draft, compare it with what is live, then publish.
import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, ErrorState, Field, Loading, Modal, PageHead, fmtDate, label, useList, useToast } from '../ui'

function Editor({ block, onClose, onSaved }) {
  const { can } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(() => Object.fromEntries(block.fields.map((f) => [f, (block.draft ?? block.published ?? {})[f] ?? ''])))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState('')
  const manage = can('content.manage')
  const run = async (kind, fn, msg) => {
    setBusy(kind); setErrors({})
    try { await fn(); toast(msg); onSaved(); if (kind !== 'save') onClose() } catch (e) { setErrors({ ...e.details, form: e.message }) } finally { setBusy('') }
  }
  const clean = () => Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
  const save = () => api(`/content/${block.key}`, { method: 'PUT', body: clean() })
  return (
    <Modal open onClose={onClose} wide title={block.label}
      footer={manage && <><Button onClick={onClose}>Close</Button>
        {block.draft && <Button onClick={() => run('discard', () => api(`/content/${block.key}/discard`, { method: 'POST' }), 'Draft discarded')} busy={busy === 'discard'}>Discard draft</Button>}
        <Button busy={busy === 'save'} onClick={() => run('save', save, 'Draft saved')}>Save draft</Button>
        <Button variant="primary" busy={busy === 'publish'} onClick={() => run('publish', async () => { await save(); await api(`/content/${block.key}/publish`, { method: 'POST' }) }, 'Published to the website content')}>Save and publish</Button></>}>
      <div className="a-grid2">
        <div>{block.fields.map((f) => <Field key={f} label={label(f)} error={errors[f]}>{(id) => (manage ? <textarea id={id} className="a-input" rows={f === 'items' || f === 'body' ? 6 : 2} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /> : <p className="a-readonly">{form[f] || '-'}</p>)}</Field>)}</div>
        <div className="a-preview"><h3>Draft preview</h3>{Object.entries(clean()).map(([k, v]) => <p key={k}><small className="a-muted">{label(k)}</small><br />{v}</p>)}
          <h3>Live now</h3>{block.published ? Object.entries(block.published).map(([k, v]) => <p key={k}><small className="a-muted">{label(k)}</small><br />{v}</p>) : <p className="a-muted">Nothing published yet.</p>}</div>
      </div>
      {errors.form && <p className="a-error" role="alert">{errors.form}</p>}
    </Modal>
  )
}

export default function Content() {
  const { data, loading, error, reload } = useList('/content')
  const [open, setOpen] = useState(null)
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} retry={reload} />
  return (
    <>
      <PageHead title="Website content" sub="Editable blocks. Changes stay in draft until published. The public site reads published blocks from the content API." />
      <div className="a-cards">{data.items.map((b) => (
        <article key={b.key} className="a-card"><h2>{b.label}</h2><p className="a-muted"><code>{b.key}</code></p>
          <p><Badge value={b.status} />{b.publishedAt && <small className="a-muted"> published {fmtDate(b.publishedAt)}</small>}</p>
          <Button onClick={() => setOpen(b)}>Open</Button></article>))}</div>
      {open && <Editor block={open} onClose={() => setOpen(null)} onSaved={reload} />}
    </>
  )
}
