import type { LegalDoc } from './legal'

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main className="legal">
      <article className="container legal-inner">
        <div className="eyebrow">Legal</div>
        <h1 className="h2">{doc.title}</h1>
        <p className="legal-updated">Last updated {doc.updated}</p>
        <p className="lead">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.map((b) => (
              <p key={b}>{b}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </main>
  )
}
