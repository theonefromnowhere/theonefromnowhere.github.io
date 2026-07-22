import { forwardRef, type ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  /** 'hub' centres it; 'section' pins it to the left of wide viewports. */
  variant: 'hub' | 'section'
  /**
   * Which section is showing, surfaced as `data-section` so panels.css can
   * size an individual one — Experience carries the most content and needs
   * more width than the rest.
   */
  section?: string
  className?: string
}

/**
 * The glass slab everything reads on.
 *
 * The surface is opaque enough to hold contrast on its own — the sky behind it
 * runs from near-black to pale peach depending on where the camera is, so
 * anything relying on the backdrop blur for legibility would fail somewhere
 * along the flight path.
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { children, variant, section, className },
  ref,
) {
  return (
    <div
      ref={ref}
      data-section={section}
      className={['panel', `panel--${variant}`, className].filter(Boolean).join(' ')}
    >
      <div className="panel__scroll">{children}</div>
    </div>
  )
})
