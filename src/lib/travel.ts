import { useSyncExternalStore } from 'react'

/**
 * Bridges the camera flight (inside useFrame) to the UI, which needs to know
 * when to open a panel.
 *
 * The camera writes `progress` every frame — that's a plain mutable field read
 * only by shaders, never by React. The `traveling` boolean is the only
 * reactive part, and it flips exactly twice per navigation, so the UI
 * re-renders twice rather than sixty times a second.
 */

let traveling = false
const listeners = new Set<() => void>()

export const travel = {
  /** 0 at departure, 1 on arrival. Read from useFrame only. */
  progress: 1,
}

export function setTraveling(next: boolean) {
  if (next === traveling) return
  traveling = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTraveling(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => traveling,
    () => false,
  )
}
