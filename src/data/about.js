// Copy for the About page. Wording only; no claims about outcomes, team or partners.
const I = {
  build: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  collaborate: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.5 2.3 3.5 5.2',
  feedback: 'M4 5h16v11H9l-5 4zM8.5 10h7',
  market: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.500 5.500 12 3z',
}

export const doing = [
  { id: 'build', title: 'Build', short: 'Turn ideas into prototypes, tools, models or products.', more: 'Bring a rough idea and start making it. A notebook, a small model or a working demo all count as progress.', icon: I.build },
  { id: 'collaborate', title: 'Collaborate', short: 'Work alongside people who enjoy solving problems.', more: 'Sit near developers, data people and founders. Ask a question, pair up, or just see how others work.', icon: I.collaborate },
  { id: 'feedback', title: 'Get feedback', short: 'Share your work, hear different views and improve.', more: 'Show what you have, even if it is unfinished. Different perspectives help you spot what to fix next.', icon: I.feedback },
  { id: 'market', title: 'Explore the market', short: 'Learn how to present your product and find people who may need it.', more: 'Think about who the product is for and how to explain it clearly, so you can start real conversations.', icon: I.market },
]

export const steps = [
  { title: 'Find an idea', body: 'Start with a problem you care about, or a skill you want to put to use. It does not need to be perfect. It only needs to be yours.' },
  { title: 'Build something', body: 'Turn the idea into something you can open, run or show. Small and working beats big and imaginary.' },
  { title: 'Share and learn', body: 'Show it to the people around you. Listen, ask questions, and improve it based on what you hear.' },
  { title: 'Take it further', body: 'Decide what comes next: polish it, test it with real users, or start something new with what you learned.' },
]

export const audience = [
  'Data science and AI learners',
  'Developers and builders',
  'People experimenting with new ideas',
  'Aspiring founders and product creators',
]
