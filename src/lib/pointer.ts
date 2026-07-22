/**
 * Module-level animation input.
 *
 * The camera rig needs pointer position every frame, but React must not
 * re-render when it changes — that is the usual cause of stutter in R3F sites.
 * So it lives in one mutable object that a listener writes and `useFrame`
 * reads. Nothing here ever calls setState.
 */
export const pointer = {
  /** -1 (left) .. 1 (right) */
  x: 0,
  /** -1 (top) .. 1 (bottom) */
  y: 0,
}

let started = false

function onPointerMove(e: PointerEvent) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1
}

/** Idempotent; safe to call from every component that needs the values. */
export function startPointerTracking(): () => void {
  if (started) return () => {}
  started = true

  window.addEventListener('pointermove', onPointerMove, { passive: true })

  return () => {
    window.removeEventListener('pointermove', onPointerMove)
    started = false
  }
}
