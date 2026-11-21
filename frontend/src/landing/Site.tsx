import './landing.css'
import { Icon, Logo } from './Icons'
import { ThemeToggle } from './ThemeToggle'
import { REPO_URL, footer, nav } from './content'

export function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="/#top" className="brand">
          <Logo />
          Nextsci
        </a>
        <nav className="nav-links" aria-label="Sections">
          {nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <a className="btn btn-secondary btn-sm" href={REPO_URL}>
            <Icon name="github" /> GitHub
          </a>
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-about">
            <a href="/#top" className="brand">
              <Logo size={18} />
              Nextsci
            </a>
            <p>{footer.tagline}</p>
          </div>
          {footer.columns.map((c) => (
            <nav key={c.title} className="footer-col" aria-label={c.title}>
              <h2>{c.title}</h2>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="footer-note">{footer.note}</p>
      </div>
    </footer>
  )
}
