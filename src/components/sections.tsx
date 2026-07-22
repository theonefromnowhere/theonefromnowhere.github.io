import { arxivUrl, site, type SectionId } from '../content/site'

/**
 * Section bodies. Each renders under the shared heading that SectionStage puts
 * above it, so none of them repeat the title.
 */

function About() {
  return (
    <>
      {site.about.body.map((paragraph) => (
        <p key={paragraph.slice(0, 32)} className="prose">
          {paragraph}
        </p>
      ))}

      <ul className="skills">
        {site.about.skills.map((group) => (
          <li key={group.group}>
            <h3 className="skills__group">{group.group}</h3>
            <ul className="tags">
              {group.items.map((item) => (
                <li key={item} className="tag">
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="meta">{site.about.languages}</p>
    </>
  )
}

function Experience() {
  return (
    <>
      <ol className="timeline">
        {site.roles.map((role) => (
          <li key={`${role.org}-${role.period}`} className="role">
            <div className="role__head">
              <h3 className="role__title">{role.title}</h3>
              <span className="role__period">{role.period}</span>
            </div>
            <p className="role__org">
              {role.org} · {role.location}
            </p>
            <ul className="role__points">
              {role.points.map((point) => (
                <li key={point.slice(0, 32)}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <h3 className="subheading">Education</h3>
      <ul className="education">
        {site.education.map((entry) => (
          <li key={entry.degree}>
            <span className="education__degree">{entry.degree}</span>
            <span className="education__org">{entry.org}</span>
            <span className="education__period">{entry.period}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Publications() {
  const total = site.publications.reduce((sum, p) => sum + p.citations, 0)

  return (
    <>
      <p className="meta">
        {site.publications.length} papers · {total.toLocaleString('en-US')} citations ·
        by date of journal publication · snapshot from INSPIRE-HEP
      </p>

      <ul className="papers">
        {site.publications.map((publication) => (
          <li key={publication.arxiv}>
            <a
              className="paper"
              href={arxivUrl(publication.arxiv)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="paper__title">{publication.title}</span>
              <span className="paper__meta">
                {publication.collaboration && (
                  <span className="badge">{publication.collaboration}</span>
                )}
                <span>{publication.reference}</span>
                <span className="paper__cites">{publication.citations} citations</span>
                <span className="paper__arxiv">arXiv:{publication.arxiv}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

function Contact() {
  return (
    <>
      <p className="prose">{site.contact.note}</p>
      <ul className="links">
        {site.links.map((link) => (
          <li key={link.label}>
            <a
              className="link"
              href={link.href}
              {...(link.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer noopener' }
                : {})}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="meta">
        © {new Date().getFullYear()} {site.name}
      </p>
    </>
  )
}

export const SECTION_BODIES: Record<SectionId, () => React.JSX.Element> = {
  about: About,
  experience: Experience,
  publications: Publications,
  contact: Contact,
}
