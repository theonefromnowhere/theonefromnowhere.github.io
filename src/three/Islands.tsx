import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildIslandGeometry } from './island'
import { Waterfall } from './Waterfall'
import { allStations, VIEW_ORBIT } from './world'

/**
 * Flying islands, scattered high across the world.
 *
 * Each gets its own geometry — the silhouettes have to differ or the sky reads
 * as a copy-paste — but they all share one material, so the extra cost is a
 * handful of draw calls. They sit off the flight corridor and well into the
 * fog, which is what keeps them background rather than obstacle.
 */

type IslandSpec = {
  seed: number
  position: [number, number, number]
  radius: number
  depth: number
  spin: number
  bob: number
  /**
   * Water pouring off the rim. Only worth giving to the near islands: at
   * distance the fog swallows it and it costs a transparent draw for nothing.
   * `angle` places the spout around the rim, `width` is the curtain's width at
   * the top.
   */
  falls?: Array<{ angle: number; width: number }>
}

/**
 * Altitudes stay above ~26 so no keel can reach the peaks (the terrain tops out
 * around 22). Sizes and distances are mixed deliberately: a few near enough to
 * read as islands, the rest far enough to sit in the haze as silhouettes.
 */
const ISLANDS: IslandSpec[] = [
  // Near, framed against the home view — these are the ones with waterfalls.
  {
    seed: 101,
    position: [-40, 31, -16],
    radius: 8,
    depth: 10,
    spin: 0.012,
    bob: 0.9,
    falls: [
      { angle: 0.6, width: 3.4 },
      { angle: 2.9, width: 2.2 },
    ],
  },
  {
    seed: 202,
    position: [26, 33, -22],
    radius: 6.5,
    depth: 8,
    spin: -0.009,
    bob: 1.2,
    falls: [{ angle: 3.9, width: 2.8 }],
  },
  {
    seed: 909,
    position: [-44, 27, -46],
    radius: 7,
    depth: 9,
    spin: 0.013,
    bob: 1.3,
    falls: [{ angle: 1.8, width: 2.6 }],
  },
  // Mid-distance, along the flight corridor.
  { seed: 303, position: [-12, 46, -58], radius: 11, depth: 14, spin: 0.007, bob: 0.7 },
  { seed: 404, position: [46, 30, -62], radius: 6, depth: 8, spin: -0.014, bob: 1.4 },
  { seed: 505, position: [-52, 40, -76], radius: 8, depth: 10, spin: 0.01, bob: 1.0 },
  { seed: 220, position: [4, 31, -96], radius: 7, depth: 9, spin: -0.012, bob: 1.1 },
  // Far, pure silhouette.
  { seed: 606, position: [14, 38, -118], radius: 10, depth: 12, spin: -0.008, bob: 0.8 },
  { seed: 707, position: [-36, 58, -36], radius: 5, depth: 7, spin: 0.016, bob: 1.6 },
  { seed: 808, position: [64, 52, -92], radius: 7.5, depth: 9, spin: -0.011, bob: 1.1 },
]

/**
 * Extra room between an island's bounding sphere and the camera.
 *
 * Modest on purpose. The sphere already uses `max(radius, depth)` in every
 * direction, which for these keel-heavy shapes overestimates the horizontal
 * extent by a wide margin, so the effective gap is larger than this number
 * suggests. Raising it forces islands to shove each other around the map and
 * climb out of the composition to find room.
 */
const ISLAND_CLEARANCE = 6
/** Samples per flight path. The path is exactly parameterised by progress. */
const PATH_SAMPLES = 12

/**
 * Every point the camera can occupy on a station-to-station flight: the
 * stations themselves and the arced paths between each pair.
 *
 * The cinematic orbit is handled separately, by `clearOfOrbit` — sampling a
 * ring as points and pushing away from each in turn makes an island chase its
 * own tail around the circle and fling itself hundreds of units away.
 *
 * This mirrors the rig's geometry exactly. `CameraRig` damps its position
 * toward the target and lifts it by `sin(π · progress) · arcHeight`, where
 * progress is `1 − remaining/departure`. Damping changes how fast the camera
 * moves along the path but not which points it passes through, so sampling
 * progress uniformly traces the real flight path.
 */
function cameraPath(): THREE.Vector3[] {
  const points: THREE.Vector3[] = allStations.map((s) => s.position.clone())

  for (let i = 0; i < allStations.length; i++) {
    for (let j = i + 1; j < allStations.length; j++) {
      const from = allStations[i].position
      const to = allStations[j].position
      // Must match ARC_FACTOR / MAX_ARC in CameraRig.tsx.
      const arc = Math.min(from.distanceTo(to) * 0.3, 28)

      for (let k = 1; k < PATH_SAMPLES; k++) {
        const p = k / PATH_SAMPLES
        const point = from.clone().lerp(to, p)
        point.y += Math.sin(Math.PI * p) * arc
        points.push(point)
      }
    }
  }

  return points
}

/**
 * Pushes an island clear of the cinematic orbit, radially with respect to the
 * orbit's centre — the shortest move that works, and a single decision rather
 * than an accumulation of nudges.
 *
 * An island escapes either by being vertically clear of the band the orbit
 * sweeps, or by sitting far enough inside or outside the ring. The vertical
 * slack it already has reduces the horizontal distance it needs, which is why
 * `needed` is the leg of a right triangle rather than the full clearance.
 *
 * Returns whether it had to move.
 */
function clearOfOrbit(position: THREE.Vector3, bound: number): boolean {
  const required = bound + ISLAND_CLEARANCE
  const top = VIEW_ORBIT.altitude + VIEW_ORBIT.altitudeSwing
  const bottom = VIEW_ORBIT.altitude - VIEW_ORBIT.altitudeSwing

  const verticalGap =
    position.y > top ? position.y - top : position.y < bottom ? bottom - position.y : 0
  if (verticalGap >= required) return false

  const needed = Math.sqrt(Math.max(required * required - verticalGap * verticalGap, 0))

  const dx = position.x - VIEW_ORBIT.centre.x
  const dz = position.z - VIEW_ORBIT.centre.z
  const distance = Math.hypot(dx, dz)
  if (Math.abs(distance - VIEW_ORBIT.radius) >= needed) return false

  const inside = distance < VIEW_ORBIT.radius
  let target = inside ? VIEW_ORBIT.radius - needed - 1 : VIEW_ORBIT.radius + needed + 1
  // Moving inward would take it through the centre and out the far side.
  if (target < 0) target = VIEW_ORBIT.radius + needed + 1

  const ux = distance < 1e-6 ? 1 : dx / distance
  const uz = distance < 1e-6 ? 0 : dz / distance
  position.x = VIEW_ORBIT.centre.x + ux * target
  position.z = VIEW_ORBIT.centre.z + uz * target
  return true
}

/** How badly a position violates its clearances: 0 or more means it is clear. */
function worstGap(position: THREE.Vector3, path: THREE.Vector3[], required: number): number {
  let worst = Infinity

  for (const point of path) worst = Math.min(worst, position.distanceTo(point) - required)

  // Distance to the nearest point of the orbit band, measured in the ring's
  // own cylindrical terms rather than by sampling it.
  const top = VIEW_ORBIT.altitude + VIEW_ORBIT.altitudeSwing
  const bottom = VIEW_ORBIT.altitude - VIEW_ORBIT.altitudeSwing
  const dy =
    position.y > top ? position.y - top : position.y < bottom ? bottom - position.y : 0
  const radial = Math.abs(
    Math.hypot(position.x - VIEW_ORBIT.centre.x, position.z - VIEW_ORBIT.centre.z) -
      VIEW_ORBIT.radius,
  )
  return Math.min(worst, Math.hypot(dy, radial) - required)
}

/**
 * Pushes an island clear of anywhere the camera goes — stations, flight paths
 * and the cinematic orbit.
 *
 * Without this, an island sitting on the camera's route swallows it, and the
 * screen fills with the near-black interior of its keel, which looks exactly
 * like a broken renderer. Doing it here rather than by hand-tuning coordinates
 * means retuning a station cannot silently reintroduce the problem.
 *
 * This is a relaxation, not a one-shot solve: the constraints overlap, so
 * escaping one can breach another. Two things keep it stable. Moves are damped
 * to a fraction of the violation, which stops an island ping-ponging between a
 * flight path and the orbit ring and flinging itself hundreds of units away.
 * And the best position seen is kept, so a run that never fully converges still
 * returns the least-bad answer instead of wherever it happened to stop.
 */
function resolvePlacement(spec: IslandSpec, path: THREE.Vector3[]): THREE.Vector3 {
  // Conservative bounding sphere: the keel reaches further than the rim.
  const bound = Math.max(spec.radius, spec.depth)
  const required = bound + ISLAND_CLEARANCE

  const position = new THREE.Vector3(...spec.position)
  const away = new THREE.Vector3()

  const best = position.clone()
  let bestGap = worstGap(position, path, required)

  for (let pass = 0; pass < 40 && bestGap < 0; pass++) {
    for (const point of path) {
      const distance = position.distanceTo(point)
      if (distance >= required) continue

      away.copy(position).sub(point).setY(0)
      if (away.lengthSq() < 1e-6) away.set(1, 0, 0)
      // Damped: a full correction per constraint per pass oscillates.
      away.normalize().multiplyScalar((required - distance) * 0.4)
      position.add(away)
    }

    clearOfOrbit(position, bound)

    const gap = worstGap(position, path, required)
    if (gap > bestGap) {
      bestGap = gap
      best.copy(position)
    }
  }

  // Last resort: go over the top. A big island near the middle of the map can
  // have nowhere to stand — the flight arcs pass above it and the orbit ring
  // around it — and sliding sideways only trades one breach for another.
  // Height always works, because every camera path has a bounded ceiling.
  for (let lift = 0; lift < 8 && bestGap < 0; lift++) {
    best.y += -bestGap + 1
    bestGap = worstGap(best, path, required)
  }

  return best
}

export function Islands({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null)
  const time = useRef(0)

  const geometries = useMemo(
    () =>
      ISLANDS.map((island) =>
        buildIslandGeometry({
          seed: island.seed,
          radius: island.radius,
          depth: island.depth,
        }),
      ),
    [],
  )

  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    [],
  )

  const placements = useMemo(() => {
    const path = cameraPath()
    return ISLANDS.map((island) => resolvePlacement(island, path))
  }, [])

  useEffect(() => {
    return () => {
      for (const geometry of geometries) geometry.dispose()
      material.dispose()
    }
  }, [geometries, material])

  useFrame((_state, delta) => {
    if (!animate || !group.current) return
    time.current += Math.min(delta, 1 / 30)

    const children = group.current.children
    for (let i = 0; i < children.length; i++) {
      // Bob around the resolved height, not the authored one — otherwise the
      // first frame of animation undoes the clearance pass.
      children[i].rotation.y = time.current * ISLANDS[i].spin
      children[i].position.y =
        placements[i].y + Math.sin(time.current * 0.18 + i) * ISLANDS[i].bob
    }
  })

  return (
    <group ref={group}>
      {ISLANDS.map((island, i) => (
        // One group per island so the falls are children of it, inheriting the
        // bob — water that stayed put while its island drifted would read as
        // two unrelated objects.
        <group key={island.seed} position={placements[i]}>
          <mesh geometry={geometries[i]} material={material} />

          {island.falls?.map((fall, j) => (
            <Waterfall
              key={j}
              seed={island.seed + j * 37}
              // On the lip. The island's profile puts the rim at local y = 0
              // with the grass cap above it and the keel tapering in below, so
              // this spills over the edge and falls clear of the rock — rather
              // than starting inside the keel, under the middle of the island.
              position={[
                Math.cos(fall.angle) * island.radius * 0.92,
                0,
                Math.sin(fall.angle) * island.radius * 0.92,
              ]}
              width={fall.width}
              // Down to roughly sea level. It has faded to nothing well before
              // then, so this only has to be about right.
              length={Math.max(placements[i].y - 1, 8)}
              animate={animate}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
