import { site } from '../content/site'
import { routeHref } from '../lib/navigation'

/**
 * The entry panel. Every section is a real anchor to its hash route, so
 * keyboard navigation, middle-click and link sharing all work without any of
 * this knowing about the camera.
 */
export function Hub() {
  return (
    <>
      <p className="hub__location">{site.location}</p>
      <h1 className="hub__name">
        {site.name}
        <span className="hub__role">, {site.role}</span>
      </h1>
      <p className="hub__tagline">{site.tagline}</p>
      <p className="hub__intro">{site.intro}</p>

      <nav className="choices" aria-label="Sections">
        <ul>
          {site.sections.map((section) => (
            <li key={section.id}>
              <a className="choice" href={routeHref(section.id)}>
                <span className="choice__label">{section.label}</span>
                <span className="choice__blurb">{section.blurb}</span>
                <span className="choice__arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
