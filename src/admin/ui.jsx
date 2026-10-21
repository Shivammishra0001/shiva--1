// Shared admin components: icons, buttons, badges, dialogs, forms, tables, toasts and list loading.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { api, qs } from './api'

export const cx = (...a) => a.filter(Boolean).join(' ')
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
export const label = (s) => String(s ?? '').replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export const Icon = ({ d, size = 18 }) => <svg className="a-ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>

export function Button({ variant = 'default', busy, children, className, ...rest }) {
  return <button type="button" className={cx('a-btn', `a-btn--${variant}`, className)} disabled={busy || rest.disabled} aria-busy={busy || undefined} {...rest}>{busy && <span className="a-spin" aria-hidden="true" />}{children}</button>
}

const TONES = { open: 'info', critical: 'bad', high: 'warn', medium: 'info', low: 'muted', escalated: 'bad', reversed: 'ok', upheld: 'muted', dismissed: 'muted', pending_review: 'warn', removed: 'bad', restricted: 'bad', under_appeal: 'info', system: 'muted', member: 'info', active: 'ok', published: 'ok', market_ready: 'ok', completed: 'ok', resolved: 'ok', success: 'ok', registered: 'ok', attended: 'ok', suspended: 'warn', draft: 'muted', archived: 'muted', closed: 'muted', empty: 'muted', cancelled: 'bad', deleted: 'bad', failed: 'bad', denied: 'bad', no_show: 'bad', new: 'info', in_progress: 'info', under_review: 'info', registration_closed: 'warn', beta: 'warn', under_development: 'info' }
export const Badge = ({ value, children }) => <span className={cx('a-badge', `a-badge--${TONES[value] ?? 'muted'}`)}>{children ?? label(value)}</span>

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random()
    setItems((l) => [...l, { id, message, tone }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 5000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="a-toasts" role="status" aria-live="polite">{items.map((t) => <p key={t.id} className={cx('a-toast', `a-toast--${t.tone}`)}>{t.message}</p>)}</div>
    </ToastCtx.Provider>
  )
}

/* ---------- dialogs (native <dialog>: focus trap and Escape for free) ---------- */
export function Modal({ open, onClose, title, children, wide, footer }) {
  const ref = useRef(null)
  const tid = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog ref={ref} className={cx('a-dialog', wide && 'a-dialog--wide')} aria-labelledby={tid} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="a-dialog__box">
          <header><h2 id={tid}>{title}</h2><button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close"><Icon d="M6 6l12 12M18 6L6 18" /></button></header>
          <div className="a-dialog__body">{children}</div>
          {footer && <footer>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

// Sensitive actions always go through this: a clear title, the consequence, and an explicit button label.
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger, input }) {
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setValue(''); setError(''); setBusy(false) } }, [open])
  const run = async () => {
    setBusy(true); setError('')
    try { await onConfirm(value); onClose() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const ready = !input || (input.match ? value === input.match : value.trim().length >= (input.min ?? 1))
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} busy={busy} disabled={!ready} onClick={run}>{confirmLabel}</Button></>}>
      <p className="a-muted">{body}</p>
      {input && <Field label={input.label}>{(id) => <input id={id} className="a-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={input.placeholder} autoComplete="off" />}</Field>}
      {error && <p className="a-error" role="alert">{error}</p>}
    </Modal>
  )
}

/* ---------- forms ---------- */
export function Field({ label: text, error, hint, children }) {
  const id = useId()
  return (
    <div className={cx('a-field', error && 'has-error')}>
      <label htmlFor={id}>{text}</label>
      {children(id)}
      {hint && !error && <p className="a-hint">{hint}</p>}
      {error && <p className="a-error" role="alert">{error}</p>}
    </div>
  )
}

/* ---------- states ---------- */
export const Loading = ({ text = 'Loading' }) => <div className="a-state" role="status"><span className="a-spin a-spin--lg" aria-hidden="true" />{text}…</div>
export const Empty = ({ title, body, action }) => <div className="a-state"><h3>{title}</h3>{body && <p className="a-muted">{body}</p>}{action}</div>
export const ErrorState = ({ error, retry }) => <div className="a-state a-state--bad" role="alert"><h3>Could not load this</h3><p className="a-muted">{error?.message}</p>{retry && <Button onClick={retry}>Try again</Button>}</div>
export const Denied = () => <div className="a-state"><h3>You do not have access to this page</h3><p className="a-muted">Ask a Super Admin to grant the permission if you need it.</p></div>

/* ---------- data ---------- */
// Fetches a list from the server (filtering and paging happen there). Re-fetches when `params` change.
export function useList(path, params = {}, enabled = true) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const key = path + qs(params)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    api(key).then((data) => live && setState({ loading: false, error: null, data })).catch((error) => live && setState({ loading: false, error, data: null }))
    return () => { live = false }
  }, [key, tick, enabled])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export function Pagination({ data, onPage }) {
  if (!data || data.pages <= 1) return data ? <p className="a-muted a-count">{data.total} {data.total === 1 ? 'result' : 'results'}</p> : null
  return (
    <nav className="a-pager" aria-label="Pages">
      <span className="a-muted">{data.total} results · page {data.page} of {data.pages}</span>
      <span><Button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</Button><Button disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>Next</Button></span>
    </nav>
  )
}

export function Table({ columns, rows, onRow, empty }) {
  if (!rows.length) return empty
  return (
    <div className="a-tablewrap">
      <table className="a-table">
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.className}>{c.title}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id ?? r.key} className={cx(onRow && 'is-click')} onClick={onRow ? () => onRow(r) : undefined}>
            {columns.map((c, i) => <td key={c.key} data-label={c.title} className={c.className}>{onRow && i === 0 ? <button type="button" className="a-rowbtn" onClick={(e) => { e.stopPropagation(); onRow(r) }}>{c.render(r)}</button> : c.render(r)}</td>)}
          </tr>))}</tbody>
      </table>
    </div>
  )
}

export function PageHead({ title, sub, actions }) {
  return <div className="a-pagehead"><div><h1>{title}</h1>{sub && <p className="a-muted">{sub}</p>}</div>{actions && <div className="a-actions">{actions}</div>}</div>
}

export const Filters = ({ children }) => <div className="a-filters">{children}</div>
