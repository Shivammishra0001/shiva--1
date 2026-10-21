// Booking form options. No prices are shown: the owner confirms pricing on WhatsApp.
export const seatOptions = [1, 2, 4, 6, 8, 10]

export const plans = [
  { id: 'daily', name: 'Daily', note: 'Day pass' },
  { id: 'monthly', name: 'Monthly', note: 'Regular seat' },
  { id: 'yearly', name: 'Yearly', note: 'Long-term seat' },
]

export const perks = [
  { title: 'Focused Work Environment', body: 'Distraction-free zone designed for deep work and real building.', icon: 'M3 5h18v11H3zM2 20h20' },
  { title: 'Builder Community Access', body: 'Sit alongside data scientists, AI founders and engineers.', icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.5 2.3 3.5 5.2' },
  { title: 'High-Speed Internet + AC + Coffee', body: 'Everything you need to stay in execution mode.', icon: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01' },
]

export const contactIcons = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  seat: 'M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M4 12a2 2 0 0 1 2 2v3h12v-3a2 2 0 0 1 4 0v5H2v-5a2 2 0 0 1 2-2zM6 20v2M18 20v2',
}
