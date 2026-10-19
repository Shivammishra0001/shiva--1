// Booking form options. Prices follow the owner's booking mock-up: only the
// 8-hour pass is priced (₹3,000); the others read "Price on request".
// This conflicts with the PDF's ₹200 / ₹500, so owner confirmation is needed.
export const topics = ['Data Science & ML', 'Generative AI & LLMs', 'Data Engineering', 'Data Analytics', 'MLOps & Deployment', 'Just here to build']

export const durations = [
  { id: '2h', hours: '2 Hours', note: 'Quick sprint', price: null },
  { id: '4h', hours: '4 Hours', note: 'Half day', price: null },
  { id: '8h', hours: '8 Hours', note: 'Full Day Power Mode', price: 3000, badge: 'Best value' },
]

// Start times as 24h hours; labels are generated from them.
export const slotHours = [9, 10, 11, 12, 13, 14, 15, 16]

export const perks = [
  { title: 'Focused Work Environment', body: 'Distraction-free zone designed for deep work and real building.', icon: 'M3 5h18v11H3zM2 20h20' },
  { title: 'Builder Community Access', body: 'Sit alongside data scientists, AI founders and engineers.', icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.5 2.3 3.5 5.2' },
  { title: 'High-Speed Internet + AC + Coffee', body: 'Everything you need to stay in execution mode.', icon: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01' },
]
