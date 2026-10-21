// Sidebar and route table. `perm` hides the link and shows "no access" on the page; the server enforces it regardless.
// To add a page: create it in pages/, then add one line here.
export const NAV = [
  { group: 'Overview', items: [{ path: '/admin', label: 'Dashboard', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' }] },
  { group: 'People', items: [
    { path: '/admin/users', label: 'Users', perm: 'users.read', icon: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8' },
    { path: '/admin/roles', label: 'Roles', perm: 'roles.read', icon: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4' },
  ] },
  { group: 'Platform', items: [
    { path: '/admin/communities', label: 'Communities', perm: 'communities.read', icon: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M5 22v-4a7 7 0 0 1 14 0v4' },
    { path: '/admin/cohorts', label: 'Cohorts', perm: 'cohorts.read', icon: 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4' },
    { path: '/admin/events', label: 'Events', perm: 'events.read', icon: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1' },
    { path: '/admin/projects', label: 'Projects', perm: 'projects.read', icon: 'M12 3l9 5v8l-9 5-9-5V8zM12 12l9-4M12 12v9M12 12L3 8' },
    { path: '/admin/content', label: 'Website content', perm: 'content.read', icon: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5' },
    { path: '/admin/moderation', label: 'Moderation', perm: 'moderation.review', icon: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM12 8v5M12 16h.01' },
    { path: '/admin/enquiries', label: 'Enquiries', perm: 'enquiries.read', icon: 'M4 5h16v12H8l-4 4zM8 10h8M8 13h5' },
  ] },
  { group: 'System', items: [
    { path: '/admin/reports', label: 'Reports', perm: 'reports.read', icon: 'M5 20V10M12 20V4M19 20v-7' },
    { path: '/admin/audit-logs', label: 'Audit log', perm: 'audit.read', icon: 'M9 4h6l4 4v12H5V4zM9 13h6M9 17h6M14 4v4h4' },
    { path: '/admin/settings', label: 'Settings', perm: 'settings.read', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2' },
  ] },
]
export const ALL_ITEMS = NAV.flatMap((g) => g.items)
