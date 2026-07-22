import { useEffect, useRef, useState } from 'react'
import { findSection, site } from '../content/site'
import { routeHref, useRoute, type Route } from '../lib/navigation'
import { useTraveling } from '../lib/travel'
import { Hub } from './Hub'
import { Panel } from './Panel'
import { SECTION_BODIES } from './sections'

/** Must match the panel exit transition in panels.css. */
const EXIT_MS = 260

/**
 * Sequences the panel against the camera.
 *
 * The outgoing panel leaves quickly, then the incoming one begins fading in
 * straight away and takes its time — the long fade runs concurrently with the
 * flight, so the content resolves as the camera settles instead of popping in
 * once it has stopped. The durations live in panels.css; EXIT_MS mirrors the
 * exit one because the content swap has to happen after the old panel is gone.
 */
export function Stage() {
  const route = useRoute()
  const traveling = useTraveling()

  const [displayed, setDisplayed] = useState<Route>(route)
  const [visible, setVisible] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Fade the outgoing panel, then swap the content underneath it.
  useEffect(() => {
    if (route === displayed) return
    setVisible(false)
    const timer = setTimeout(() => setDisplayed(route), EXIT_MS)
    return () => clearTimeout(timer)
  }, [route, displayed])

  // Reveal as soon as the content has caught up — mid-flight, deliberately.
  useEffect(() => {
    if (displayed === route) setVisible(true)
  }, [displayed, route])

  // Hash navigation does not move focus or announce anything on its own, so a
  // keyboard or screen-reader user would be left where they were. Move focus to
  // the new heading, and keep the document title in step.
  useEffect(() => {
    if (!visible) return
    const section = findSection(displayed)
    document.title = section ? `${section.title} — ${site.name}` : site.name
    headingRef.current?.focus()
  }, [visible, displayed])

  const section = findSection(displayed)
  const Body = section ? SECTION_BODIES[section.id] : null

  return (
    <div className="stage">
      <Panel
        ref={panelRef}
        variant={section ? 'section' : 'hub'}
        className={visible ? 'is-visible' : undefined}
      >
        {section && Body ? (
          <>
            <a className="back" href={routeHref('home')}>
              <span aria-hidden="true">←</span> Back
            </a>
            <p className="panel__eyebrow">{section.eyebrow}</p>
            <h2 className="panel__title" ref={headingRef} tabIndex={-1}>
              {section.title}
            </h2>
            <Body />
          </>
        ) : (
          <Hub />
        )}
      </Panel>

      {/* Announces the destination to screen readers during the flight, which
          is otherwise a silent few seconds. */}
      <p className="sr-only" role="status" aria-live="polite">
        {traveling
          ? `Travelling to ${findSection(route)?.title ?? 'the start'}`
          : (findSection(displayed)?.title ?? site.name)}
      </p>
    </div>
  )
}
