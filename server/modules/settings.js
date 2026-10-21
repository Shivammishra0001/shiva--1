// Operational settings. Only the keys listed here exist; secrets never appear. Changes need the current password.
import { badRequest } from '../lib/errors.js'
import { verifyPassword } from '../lib/crypto.js'
import { diff } from '../lib/audit.js'
import { bool, int, str, validate } from '../lib/validate.js'

export const SETTING_DEFS = {
  'site.maintenance': { label: 'Maintenance mode', hint: 'Public pages can show a maintenance notice.', spec: bool(), default: false },
  'site.announcementEnabled': { label: 'Show site announcement', hint: 'Controls whether the announcement content block is shown.', spec: bool(), default: false },
  'features.communityJoin': { label: 'Community joining', hint: 'Allow visitors to join communities.', spec: bool(), default: true },
  'features.eventRegistration': { label: 'Public event registration', hint: 'Allow visitors to register for events.', spec: bool(), default: true },
  'uploads.maxMb': { label: 'Maximum upload size (MB)', hint: 'Applies when file uploads are added.', spec: int({ min: 1, max: 25 }), default: 5 },
  'session.idleMinutes': { label: 'Session idle timeout (minutes)', hint: 'Admins are signed out after this long without activity.', spec: int({ min: 5, max: 480 }), default: 120 },
  'content.categories': { label: 'Allowed content categories', hint: 'Comma separated.', spec: str({ max: 300 }), default: 'AI, Data Science, Developer Tools, Automation' },
}

export function register(router, { store, config }) {
  const values = (db) => Object.fromEntries(Object.entries(SETTING_DEFS).map(([k, d]) => [k, db.settings[k] ?? d.default]))

  router.get('/api/admin/settings', { perm: 'settings.read' }, () => ({
    definitions: Object.entries(SETTING_DEFS).map(([key, d]) => ({ key, label: d.label, hint: d.hint, type: d.spec.type, min: d.spec.min, max: d.spec.max })),
    values: values(store.read()),
    // Status only: whether something is configured, never its value.
    integrations: [
      { name: 'Email / notifications', configured: false, note: 'No provider connected. Notices are not sent.' },
      { name: 'File storage', configured: false, note: 'No storage connected. Uploads are not available.' },
      { name: 'WhatsApp booking inbox', configured: true, note: 'Public forms open WhatsApp; they do not post to this panel.' },
      { name: 'Session security', configured: true, note: config.production ? 'Secure cookies on.' : 'Development mode: cookies are not marked Secure.' },
    ],
  }))

  router.patch('/api/admin/settings', { perm: 'settings.manage' }, async ({ body, user, auditIn }) => {
    const { currentPassword, changes } = body ?? {}
    if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, user.passwordHash))) throw badRequest('Enter your current password to change settings.', { currentPassword: 'Incorrect.' })
    const schema = Object.fromEntries(Object.entries(SETTING_DEFS).map(([k, d]) => [k, { ...d.spec, optional: true }]))
    const clean = validate(changes ?? {}, schema, { partial: true })
    return store.transaction((d) => {
      const before = values(d)
      Object.assign(d.settings, clean)
      auditIn(d, 'settings.update', 'settings', 'site', diff(before, values(d)))
      return { values: values(d) }
    })
  })
}
