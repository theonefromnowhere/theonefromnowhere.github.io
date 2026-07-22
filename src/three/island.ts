import * as THREE from 'three'

/**
 * Procedural flying islands: a grassy cap over a rocky keel.
 *
 * Built as stacked rings rather than from a primitive, because the silhouette
 * is the whole point — a rounded top that tapers to a ragged point underneath.
 * Like the terrain, the geometry is non-indexed so `computeVertexNormals()`
 * gives one normal per face and each face can carry a single flat colour.
 */

/** Deterministic per island, so the sky looks the same on every load. */
function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const GRASS: Array<{ stop: number; color: THREE.Color }> = [
  { stop: 0, color: new THREE.Color('#2f7d52') },
  { stop: 0.5, color: new THREE.Color('#4f9c5e') },
  { stop: 1, color: new THREE.Color('#86b77a') },
]

// Kept dark: islands are mostly seen from below and at a distance, where the
// fog lifts everything toward the sky colour. A lighter rock dissolves.
const ROCK_TOP = new THREE.Color('#332e5c')
const ROCK_DEEP = new THREE.Color('#15122b')

export type IslandOptions = {
  seed: number
  /** Rim radius. */
  radius?: number
  /** How far the keel hangs below the rim. */
  depth?: number
  /** Sides around the island. Low, so the facets read. */
  radialSegments?: number
}

export function buildIslandGeometry({
  seed,
  radius = 6,
  depth = 7,
  radialSegments = 9,
}: IslandOptions): THREE.BufferGeometry {
  const random = lcg(seed)

  // Ring profile from the cap down to the keel. `t` is radius as a fraction of
  // the rim, `y` is height relative to the rim.
  const profile: Array<{ t: number; y: number }> = [
    { t: 0.0, y: 0.42 }, // cap centre
    { t: 0.45, y: 0.3 },
    { t: 0.8, y: 0.14 },
    { t: 1.0, y: 0.0 }, // rim — where grass meets rock
    { t: 0.82, y: -0.3 },
    { t: 0.55, y: -0.62 },
    { t: 0.3, y: -0.85 },
    { t: 0.0, y: -1.0 }, // keel tip
  ]
  const RIM_INDEX = 3

  // Per-ring, per-segment jitter — irregular enough not to look lathed.
  const rings = profile.map(({ t, y }, ringIndex) =>
    Array.from({ length: radialSegments }, (_, seg) => {
      const angle = (seg / radialSegments) * Math.PI * 2
      const wobble = ringIndex === 0 ? 0 : 0.82 + random() * 0.36
      const r = t * radius * wobble
      const heightJitter = ringIndex === 0 || ringIndex === profile.length - 1
        ? 0
        : (random() - 0.5) * 0.9
      return new THREE.Vector3(
        Math.cos(angle) * r,
        y * (y >= 0 ? radius * 0.55 : depth) + heightJitter,
        Math.sin(angle) * r,
      )
    }),
  )

  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()

  const rimY = 0
  const capHeight = radius * 0.55

  const pushFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, grass: boolean) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)

    const centroidY = (a.y + b.y + c.y) / 3

    if (grass) {
      const t = THREE.MathUtils.clamp(centroidY / capHeight, 0, 1)
      const upper = t > 0.5 ? 2 : 1
      const lower = upper - 1
      const span = GRASS[upper].stop - GRASS[lower].stop
      color
        .copy(GRASS[lower].color)
        .lerp(GRASS[upper].color, (t - GRASS[lower].stop) / span)
    } else {
      const t = THREE.MathUtils.clamp((rimY - centroidY) / depth, 0, 1)
      color.copy(ROCK_TOP).lerp(ROCK_DEEP, t)
    }

    // Same per-face tint jitter as the terrain, for the 15-bit banding feel.
    const hash = Math.sin(a.x * 12.9898 + a.z * 78.233) * 43758.5453
    color.multiplyScalar(0.93 + 0.14 * (hash - Math.floor(hash)))

    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b)
  }

  for (let ring = 0; ring < rings.length - 1; ring++) {
    const upper = rings[ring]
    const lower = rings[ring + 1]
    const grass = ring < RIM_INDEX
    const isCapFan = ring === 0
    const isKeelFan = ring === rings.length - 2

    for (let seg = 0; seg < radialSegments; seg++) {
      const next = (seg + 1) % radialSegments

      if (isCapFan) {
        // The cap collapses to a single apex, so it is a fan, not a quad strip.
        pushFace(upper[0].clone().setX(0).setZ(0), lower[seg], lower[next], true)
      } else if (isKeelFan) {
        pushFace(upper[seg], lower[0].clone().setX(0).setZ(0), upper[next], false)
      } else {
        pushFace(upper[seg], lower[seg], lower[next], grass)
        pushFace(upper[seg], lower[next], upper[next], grass)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  return geometry
}
