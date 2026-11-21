import './landing.css'
import { Icon } from './Icons'
import {
  DispatchVisual,
  DispatcherFrame,
  ImportVisual,
  OptimizeVisual,
  PhoneFrame,
  ScheduleFrame,
} from './ProductMock'
import {
  REPO_URL,
  cta,
  driverApp,
  features,
  hero,
  roadmap,
  selfHost,
  services,
  solver,
  statusLabel,
  steps,
  values,
} from './content'

const stepVisuals = [ImportVisual, OptimizeVisual, DispatchVisual]

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-copy">
        <a className="pill load" href={REPO_URL}>
          <span className="dot dot-live" />
          {hero.pill}
          <Icon name="arrow" size={13} />
        </a>
        <h1 className="display load">{hero.title}</h1>
        <p className="lead load">{hero.lead}</p>
        <div className="hero-actions load">
          <a className="btn btn-primary btn-lg" href={hero.primary.href}>
            {hero.primary.label}
            <Icon name="arrow" size={15} />
          </a>
          <a className="btn btn-secondary btn-lg" href={hero.secondary.href}>
            <Icon name="github" size={15} />
            {hero.secondary.label}
          </a>
        </div>
      </div>
      <div className="container hero-product load">
      <DispatcherFrame />
      </div>
    </section>
  )
}

function Values() {
  return (
    <section className="values">
      <div className="container values-grid">
        {values.map((v) => (
          <div key={v.title} className="value reveal">
            <Icon name={v.icon} size={18} />
            <div>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="section-head reveal">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="h2">{title}</h2>
      {body && <p className="lead">{body}</p>}
    </div>
  )
}

function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <SectionHead
          eyebrow="Features"
          title="Everything between the order and the doorstep"
          body="The first release covers the full daily workflow of a dispatch team. Each card below is a planned capability."
        />
        <div className="feature-grid">
          {features.map((f) => (
            <article key={f.title} className="card reveal">
              <div className="card-icon">
                <Icon name={f.icon} size={18} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="section section-raised" id="how-it-works">
      <div className="container">
        <SectionHead eyebrow="How it works" title="From a list of addresses to drivers on the road" />
        <ol className="steps">
          {steps.map((s, i) => {
            const Visual = stepVisuals[i]
            return (
              <li key={s.title} className="step reveal">
                <Visual />
                <div className="step-num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function Spotlights() {
  return (
    <section className="section">
      <div className="container spotlights">
        <div className="spotlight">
          <div className="spotlight-copy reveal">
            <div className="eyebrow">{solver.eyebrow}</div>
            <h2 className="h2">{solver.title}</h2>
            <p className="lead">{solver.body}</p>
            <ul className="constraints">
              {solver.constraints.map((c) => (
                <li key={c.label}>
                  <Icon name="check" size={14} className="ok" />
                  <span>{c.label}</span>
                  <span className="constraint-value">{c.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="spotlight-visual reveal">
            <ScheduleFrame />
          </div>
        </div>
        <div className="spotlight spotlight-flip">
          <div className="spotlight-copy reveal">
            <div className="eyebrow">{driverApp.eyebrow}</div>
            <h2 className="h2">{driverApp.title}</h2>
            <p className="lead">{driverApp.body}</p>
          </div>
          <div className="spotlight-visual spotlight-phone reveal">
            <div className="phone-glow" aria-hidden="true" />
            <PhoneFrame />
          </div>
        </div>
      </div>
    </section>
  )
}

function SelfHost() {
  return (
    <section className="section section-raised" id="self-host">
      <div className="container selfhost">
        <div className="reveal">
          <div className="eyebrow">{selfHost.eyebrow}</div>
          <h2 className="h2">{selfHost.title}</h2>
          <p className="lead">{selfHost.body}</p>
          <a className="btn btn-secondary" href={`${REPO_URL}#quick-start`}>
            Read the quick start <Icon name="arrow" size={14} />
          </a>
        </div>
        <div className="frame terminal reveal">
          <div className="frame-bar">
            <span />
            <span />
            <span />
            <div className="frame-title">Terminal</div>
          </div>
          <pre>
            <code>
              {selfHost.commands.map((c) => (
                <span key={c} className="term-line">
                  <span className="term-prompt">$</span> {c}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </section>
  )
}

function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <SectionHead eyebrow={services.eyebrow} title={services.title} body={services.body} />
        <div className="feature-grid">
          {services.items.map((s) => (
            <article key={s.title} className="card reveal">
              <div className="card-icon">
                <Icon name={s.icon} size={18} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
        <div className="services-actions reveal">
          <a className="btn btn-primary" href={services.cta.href}>
            {services.cta.label} <Icon name="arrow" size={14} />
          </a>
          <p className="services-contact">
            {services.contact.label}: <a href={services.cta.href}>{services.contact.email}</a>
          </p>
        </div>
      </div>
    </section>
  )
}

function Roadmap() {
  return (
    <section className="section section-raised" id="roadmap">
      <div className="container">
        <SectionHead
          eyebrow="Roadmap"
          title="Built in the open, one piece at a time"
          body="Here is where the project stands today. Pick an item that interests you and help build it."
        />
        <ul className="roadmap reveal">
          {roadmap.map((r) => (
            <li key={r.title}>
              <span className={`status status-${r.status}`}>{statusLabel[r.status]}</span>
              <span>{r.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section className="cta">
      <div className="cta-glow" aria-hidden="true" />
      <div className="container cta-inner reveal">
        <h2 className="h2">{cta.title}</h2>
        <p className="lead">{cta.body}</p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href={REPO_URL}>
            <Icon name="github" size={15} /> Contribute on GitHub
          </a>
          <a className="btn btn-secondary btn-lg" href={`${REPO_URL}/issues`}>
            Browse issues
          </a>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <main>
      <Hero />
      <Values />
      <Features />
      <HowItWorks />
      <Spotlights />
      <SelfHost />
      <Services />
      <Roadmap />
      <Cta />
    </main>
  )
}
