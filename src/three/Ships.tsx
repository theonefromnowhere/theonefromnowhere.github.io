import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { seaHeightAt, terrainHeight, TERRAIN_CENTER } from './terrain'

/**
 * Little sailing boats out on the water.
 *
 * Each one samples the same wave function the sea's shader uses, so it rises
 * and falls with the water under it rather than sliding across a flat plane,
 * and tilts to the local slope — sampled either side of the hull, which is
 * cheaper and steadier than differentiating the wave analytically.
 *
 * Positions are searched for rather than authored: a candidate is kept only
 * where the seabed is deep enough that the boat is plainly afloat, and clear of
 * the shore.
 */

/** Seabed must be at least this far below the surface. */
const MIN_DEPTH = 3.5
/** Boats sail near the coast, not out in the empty middle of the ocean. */
const MAX_DISTANCE_FROM_CENTRE = 105

type ShipSeed = {
  x: number
  z: number
  heading: number
  scale: number
  phase: number
  /** Slow drift along the heading, in world units per second. */
  drift: number
}

function findShipSites(count: number): ShipSeed[] {
  // Fixed LCG, so the fleet is in the same place on every load.
  let state = 5150421
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  const seeds: ShipSeed[] = []
  let attempts = 0

  while (seeds.length < count && attempts < count * 400) {
    attempts++

    const x = TERRAIN_CENTER.x + (random() * 2 - 1) * MAX_DISTANCE_FROM_CENTRE
    const z = TERRAIN_CENTER.z + (random() * 2 - 1) * MAX_DISTANCE_FROM_CENTRE

    // Open water: deep here, and deep a little way around, so no boat ends up
    // straddling a rock just under the surface.
    if (terrainHeight(x, z) > -MIN_DEPTH) continue
    if (terrainHeight(x + 4, z) > -1.5 || terrainHeight(x - 4, z) > -1.5) continue
    if (terrainHeight(x, z + 4) > -1.5 || terrainHeight(x, z - 4) > -1.5) continue

    // Keep the fleet spread out.
    if (seeds.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 14 ** 2)) continue

    seeds.push({
      x,
      z,
      heading: random() * Math.PI * 2,
      scale: 0.85 + random() * 0.6,
      phase: random() * Math.PI * 2,
      drift: 0.35 + random() * 0.5,
    })
  }

  return seeds
}

function Ship({ seed, animate }: { seed: ShipSeed; animate: boolean }) {
  const group = useRef<THREE.Group>(null)
  const time = useRef(0)

  const hull = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color('#6b4a3a'),
        emissive: new THREE.Color('#2a1a22'),
        emissiveIntensity: 0.5,
        flatShading: true,
      }),
    [],
  )
  const sail = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color('#f2e6d8'),
        emissive: new THREE.Color('#7a6a8e'),
        emissiveIntensity: 0.45,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      hull.dispose()
      sail.dispose()
    }
  }, [hull, sail])

  const place = (t: number) => {
    const node = group.current
    if (!node) return

    // Drift along the heading, wrapping on a long loop so boats never sail off
    // the map or pile up.
    const travelled = ((t * seed.drift + seed.phase * 10) % 90) - 45
    const x = seed.x + Math.sin(seed.heading) * travelled
    const z = seed.z + Math.cos(seed.heading) * travelled

    node.position.set(x, seaHeightAt(x, z, t), z)

    // Tilt to the water: sample fore/aft and port/starboard of the hull.
    const reach = 1.6
    const fore = seaHeightAt(x + Math.sin(seed.heading) * reach, z + Math.cos(seed.heading) * reach, t)
    const aft = seaHeightAt(x - Math.sin(seed.heading) * reach, z - Math.cos(seed.heading) * reach, t)
    const port = seaHeightAt(x + Math.cos(seed.heading) * reach, z - Math.sin(seed.heading) * reach, t)
    const starboard = seaHeightAt(x - Math.cos(seed.heading) * reach, z + Math.sin(seed.heading) * reach, t)

    node.rotation.set(
      Math.atan2(aft - fore, reach * 2),
      seed.heading,
      Math.atan2(starboard - port, reach * 2),
    )
  }

  // Place once, so a paused (reduced-motion) scene still has boats on the water.
  useEffect(() => place(0), [])

  useFrame((_state, delta) => {
    if (!animate) return
    time.current += Math.min(delta, 1 / 30)
    place(time.current)
  })

  return (
    <group ref={group} scale={seed.scale}>
      {/* Hull, with a wedge for the prow. */}
      <mesh material={hull} position={[0, 0.25, 0]}>
        <boxGeometry args={[1.5, 0.85, 3.4]} />
      </mesh>
      <mesh material={hull} position={[0, 0.25, 2.2]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0, 1.05, 1.2, 4]} />
      </mesh>

      <mesh material={hull} position={[0, 2.6, -0.1]}>
        <boxGeometry args={[0.18, 4.4, 0.18]} />
      </mesh>

      {/* Mainsail and a small jib, both slightly bellied by the offset. */}
      <mesh material={sail} position={[0.35, 2.7, -0.35]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.08, 3.4, 2]} />
      </mesh>
      <mesh material={sail} position={[-0.25, 2.1, 1.1]} rotation={[0, -0.18, 0]}>
        <boxGeometry args={[0.08, 2.2, 1.2]} />
      </mesh>
    </group>
  )
}

export function Ships({ count, animate }: { count: number; animate: boolean }) {
  const seeds = useMemo(() => { const s = findShipSites(count); console.log('SHIPS', JSON.stringify(s.map(v=>({x:+v.x.toFixed(1), z:+v.z.toFixed(1), bed:+terrainHeight(v.x,v.z).toFixed(2)})))); return s }, [count])

  return (
    <group>
      {seeds.map((seed, i) => (
        <Ship key={i} seed={seed} animate={animate} />
      ))}
    </group>
  )
}
