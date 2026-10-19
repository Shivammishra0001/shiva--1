export function formatDateTime(isoString, timeZone = 'Asia/Kolkata') {
  const d = new Date(isoString);
  if (isNaN(d)) return 'Date TBD';
  return d.toLocaleString('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(isoString, timeZone = 'Asia/Kolkata') {
  const d = new Date(isoString);
  if (isNaN(d)) return 'Date TBD';
  return d.toLocaleDateString('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeOnly(isoString, timeZone = 'Asia/Kolkata') {
  const d = new Date(isoString);
  if (isNaN(d)) return 'Time TBD';
  return d.toLocaleTimeString('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status) {
  const labels = {
    draft: 'Draft',
    published: 'Published',
    registration_open: 'Registration Open',
    registration_closed: 'Registration Closed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

export function getStatusVariant(status) {
  const variants = {
    registration_open: 'open',
    registration_closed: 'closed',
    completed: 'completed',
    cancelled: 'cancelled',
    draft: 'draft',
    published: 'published',
  };
  return variants[status] || 'open';
}

export function getDurationHours(minutes) {
  if (!minutes) return 'TBD';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function isUpcoming(event) {
  return ['registration_open', 'registration_closed', 'published'].includes(event.status);
}

export function isPast(event) {
  return event.status === 'completed' || event.status === 'cancelled';
}

export function getUpcomingEvents(events) {
  const now = new Date();
  return events
    .filter((e) => isUpcoming(e) && new Date(e.startDateTime) > now)
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
}

export function getPastEvents(events) {
  return events
    .filter((e) => isPast(e))
    .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
}

export function getFeaturedEvent(events) {
  return events.find((e) => e.featured && isUpcoming(e));
}