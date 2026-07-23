import { useSyncExternalStore } from 'react'
import { sectionIds, type SectionId } from '../content/site'

export type Route = 'home' | 'view' | SectionId

/** Routes that correspond to a place in the world. 'view' has no station. */
export type StationRoute = Exclude<Route, 'view'>

/**
 * Hash routing, hand-rolled.
 *
 * Hash rather than history API because this deploys to GitHub Pages, where a
 * real path would 404 on refresh without a rewrite hack. Hand-rolled rather
 * than react-router because the whole router is the twenty lines below.
 */

function parse(hash: string): Route {
  const id = hash.replace(/^#\/?/, '')
  if (id === 'view') return 'view'
  return (sectionIds as string[]).includes(id) ? (id as SectionId) : 'home'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => parse(window.location.hash),
    () => 'home' as Route,
  )
}

/** The href for a route — used directly on <a>, so links stay real links. */
export function routeHref(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`
}

export function navigate(route: Route) {
  window.location.hash = routeHref(route)
}
