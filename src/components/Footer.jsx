import { navLinks, site } from '../data/siteContent'

const socials = [
  { name: 'Twitter', href: site.social.twitter, icon: '𝕏' },
  { name: 'LinkedIn', href: site.social.linkedin, icon: 'in' },
  { name: 'Instagram', href: site.social.instagram, icon: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  ) },
  { name: 'WhatsApp', href: site.social.whatsapp, icon: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457zm6.575-3.042c1.6.951 3.568 1.45 5.375 1.451 5.431 0 9.851-4.42 9.855-9.852.002-2.631-1.025-5.105-2.89-6.973A9.782 9.782 0 0 0 12.008 1.71c-5.422 0-9.842 4.419-9.846 9.853-.001 2.012.524 3.986 1.523 5.727l-.955 3.493zm12.586-7.33c-.301-.151-1.784-.881-2.056-.979-.272-.1-.471-.151-.669.151-.198.301-.769.979-.942 1.18-.174.199-.348.224-.649.075-.301-.152-1.272-.469-2.423-1.496-.895-.798-1.5-1.784-1.676-2.086-.176-.302-.019-.465.131-.614.136-.134.302-.352.453-.529.151-.176.201-.302.302-.503.101-.2.05-.377-.025-.529-.075-.151-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.784-.73 2.033-1.433.248-.704.248-1.307.174-1.432-.074-.126-.272-.201-.573-.352z"/>
    </svg>
  ) },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div id="about" className="footer__about">
          <h2 className="footer__brand">{site.name}</h2>
          <p>{site.tagline}</p>
          <p>{site.builtBy}</p>
        </div>
        <nav aria-label="Footer">
          <h3>Explore</h3>
          <ul>
            {navLinks.map((l) => (
              <li key={l.href}><a href={l.href}>{l.label}</a></li>
            ))}
          </ul>
        </nav>
        <div>
          <h3>Contact us</h3>
          <ul>
            <li>{site.location}</li>
            <li><a href={`mailto:${site.email}`}>{site.email}</a></li>
            <li><a href={site.phoneHref}>{site.phone}</a></li>
          </ul>
        </div>
        <div className="footer__social">
          <h3>Follow us</h3>
          <div className="footer__social-icons">
            {socials.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noreferrer" className="footer__social-link" aria-label={s.name}>
                <span className="footer__social-icon">{s.icon}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="container footer__legal">
        <p style={{ textAlign: 'center' }}>{site.copyright}</p>
        <p style={{ textAlign: 'center' }}><a href="/legal.html?doc=terms">Terms</a> · <a href="/legal.html?doc=privacy">Privacy</a> · <a href="/legal.html?doc=guidelines">Community Guidelines</a></p>
      </div>
    </footer>
  )
}
