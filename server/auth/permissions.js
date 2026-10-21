// Permission catalogue. Every protected API route names exactly one of these.
// To add a module: add its permissions here, then reference them from its routes and from the role templates below.
export const PERMISSIONS = {
  users: { read: 'View users', create: 'Create users', update: 'Edit users and assign roles', suspend: 'Suspend and reactivate users', delete: 'Delete users' },
  roles: { read: 'View roles', manage: 'Create and edit roles' },
  communities: { read: 'View communities', create: 'Create communities', update: 'Edit communities', publish: 'Publish and archive communities', delete: 'Delete communities' },
  cohorts: { read: 'View cohorts', create: 'Create cohorts', update: 'Edit cohorts', publish: 'Publish and archive cohorts', delete: 'Delete cohorts' },
  events: { read: 'View events', create: 'Create events', update: 'Edit events', publish: 'Publish events', cancel: 'Cancel events', delete: 'Delete events' },
  registrations: { read: 'View event registrations', manage: 'Add, cancel and mark attendance' },
  projects: { read: 'View projects', create: 'Create projects', update: 'Edit projects', publish: 'Publish projects and set Market Ready', delete: 'Delete projects' },
  content: { read: 'View website content', manage: 'Edit and publish website content' },
  moderation: { review: 'Review reports and hidden content', enforce: 'Remove content and restrict or suspend members', appeals: 'Decide appeals', evidence: 'View preserved evidence and record legal disclosures' },
  enquiries: { read: 'View enquiries', manage: 'Assign, update and close enquiries' },
  reports: { read: 'View reports', export: 'Export data' },
  audit: { read: 'View the audit log' },
  settings: { read: 'View settings', manage: 'Change settings' },
}

export const ALL_PERMISSIONS = Object.entries(PERMISSIONS).flatMap(([group, items]) => Object.keys(items).map((k) => `${group}.${k}`))
export const isPermission = (p) => ALL_PERMISSIONS.includes(p)

export const catalogue = () => Object.entries(PERMISSIONS).map(([group, items]) => ({ group, permissions: Object.entries(items).map(([k, label]) => ({ key: `${group}.${k}`, label })) }))

const reads = ALL_PERMISSIONS.filter((p) => p.endsWith('.read'))
const only = (...groups) => ALL_PERMISSIONS.filter((p) => groups.includes(p.split('.')[0]))

// Initial role templates. `system` roles cannot be deleted; super_admin always holds every permission.
export const ROLE_TEMPLATES = [
  { key: 'super_admin', name: 'Super Admin', system: true, description: 'Full access, including roles, settings and the audit log.', permissions: ALL_PERMISSIONS },
  { key: 'platform_admin', name: 'Platform Admin', system: true, description: 'Runs day-to-day operations. Cannot manage roles or settings.',
    permissions: ALL_PERMISSIONS.filter((p) => !['roles.manage', 'settings.manage', 'users.delete', 'audit.read', 'moderation.evidence'].includes(p)) },
  { key: 'content_manager', name: 'Content Manager', system: true, description: 'Manages website content and announcements.', permissions: ['content.read', 'content.manage', 'communities.read', 'events.read', 'projects.read'] },
  { key: 'community_manager', name: 'Community Manager', system: true, description: 'Manages communities and cohorts and reviews reports.', permissions: [...only('communities', 'cohorts'), 'moderation.review', 'moderation.enforce', 'moderation.appeals', 'events.read', 'projects.read'].filter((p) => !p.endsWith('.delete')) },
  { key: 'event_manager', name: 'Event Manager', system: true, description: 'Creates events, manages registrations and attendance.', permissions: [...only('events', 'registrations'), 'cohorts.read', 'cohorts.update', 'cohorts.create', 'communities.read'].filter((p) => p !== 'events.delete') },
  { key: 'project_manager', name: 'Project Manager', system: true, description: 'Reviews and publishes Market Push projects.', permissions: [...only('projects'), 'communities.read'].filter((p) => p !== 'projects.delete') },
  { key: 'moderator', name: 'Moderator', system: true, description: 'Reviews reported posts and comments.', permissions: ['moderation.review', 'moderation.enforce', 'moderation.appeals', 'communities.read', 'users.read'] },
  { key: 'member', name: 'Member', system: true, description: 'A registered community member. No admin access.', permissions: [] },
  { key: 'support_analyst', name: 'Support / Analyst', system: true, description: 'Read-only access to enquiries and reports.', permissions: [...reads.filter((p) => ['enquiries.read', 'reports.read', 'events.read', 'registrations.read', 'projects.read', 'communities.read'].includes(p))] },
]
