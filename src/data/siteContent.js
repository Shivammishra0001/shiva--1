// Business details supplied in "Data Science Co-Working Space.pdf".
// Social URLs (Instagram, LinkedIn, X) were not supplied, so they are not linked.
export const site = {
  name: 'Data Science Co-Working Space',
  shortName: 'Data Science Co-Working',
  tagline: "India's 1st dedicated AI & Data Science co-working space.",
  builtBy: 'Built by AIfactory, for future Entrepreneur.',
  location: 'Sultanpur, New Delhi, India',
  email: 'contact@CoWorkingSpace.com',
  phone: '+91 9953413662',
  phoneHref: 'tel:+919953413662',
  whatsappHref: 'https://wa.me/919953413662',
  copyright: '© 2026 DataScienceCo-WorkingSpace. Built by AIfactory. All rights reserved.',
  social: {
    twitter: 'https://x.com/datasciencecoworking',
    linkedin: 'https://linkedin.com/company/datasciencecoworking',
    instagram: 'https://instagram.com/datasciencecoworking',
    whatsapp: 'https://wa.me/919953413662',
  },
}

export const navLinks = [
  { label: 'Home', href: '/#home' },
  { label: 'Marketplace', href: '/market.html' },
  { label: 'Community', href: '/community.html', menu: 'communities' },
  { label: 'Cohort', href: '/cohort.html?c=openai', menu: 'cohorts' },
  { label: 'About', href: '/about.html' },
  { label: 'Contact', href: '/contact.html' },
]

// Google Maps embed (no API key). Swap the query for an exact address when available.
export const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(site.location)}&output=embed`
export const mapLinkHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.location)}`
