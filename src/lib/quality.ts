export type Quality = {
  /** Grid cells per side of the terrain mesh. Lower is chunkier and cheaper. */
  terrainSegments: number
  /** Floating rocks. */
  shards: number
  /** Sailing boats on the sea. */
  ships: number
  /** Bloom and vignette — the dreamy half of the look, but not free. */
  postprocessing: boolean
  /**
   * Renderer resolution multiplier. Well under 1 on purpose: rendering at a
   * fraction of the display resolution and upscaling with nearest-neighbour is
   * what gives the chunky pixels, and it happens to be a large performance win.
   */
  renderScale: number
}

const HIGH: Quality = {
  terrainSegments: 118,
  shards: 150,
  ships: 9,
  postprocessing: true,
  renderScale: 0.45,
}

const LOW: Quality = {
  terrainSegments: 78,
  shards: 60,
  ships: 4,
  postprocessing: false,
  renderScale: 0.45,
}

/**
 * Picked once at startup from cheap static signals. Live fps-based downgrade
 * is handled separately by drei's <AdaptiveDpr/>, which lowers resolution
 * further rather than regenerating geometry (which would hitch).
 */
export function detectQuality(): Quality {
  if (typeof window === 'undefined') return LOW

  const narrow = window.innerWidth < 820
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4

  return narrow || coarse || fewCores ? LOW : HIGH
}
