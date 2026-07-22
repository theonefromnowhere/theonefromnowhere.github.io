import { forwardRef, type ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  /** 'hub' centres it; 'section' pins it to the left of wide viewports. */
  variant: 'hub' | 'section'
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
  { children, variant, className },
  ref,
) {
  return (
    <div
      ref={ref}
      className={['panel', `panel--${variant}`, className].filter(Boolean).join(' ')}
    >
      <div className="panel__scroll">{children}</div>
    </div>
  )
})
