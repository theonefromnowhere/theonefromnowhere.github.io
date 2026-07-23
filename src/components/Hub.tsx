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

      {/* Not one of the sections: it leads nowhere and shows nothing, so it
          sits outside the nav rather than pretending to be a fifth choice. */}
      <a className="cinematic" href={routeHref('view')}>
        <span className="cinematic__label">Enjoy the view</span>
        <span className="cinematic__hint">
          Hide everything and drift over the world
        </span>
      </a>
    </>
  )
}
