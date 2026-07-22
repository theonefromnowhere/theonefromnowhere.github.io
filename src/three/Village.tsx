import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight } from './terrain'
import { allStations } from './world'

/**
 * A handful of cottages and a windmill, standing on the coast.
 *
 * The site is searched for rather than authored. Dropping buildings at a
 * hand-picked coordinate works right up until the terrain seed changes and the
 * village ends up underwater or halfway up a cliff; scoring candidate ground
 * for flatness keeps it standing on something sensible whatever the noise does.
 */

/** Where to look. The search finds the best ground near here. */
const PREFERRED = { x: -26, z: -34 }
const SEARCH_RADIUS = 26
const SEARCH_STEP = 2

/** Buildable ground: above the waterline, below the snowline. */
const MIN_ELEVATION = 1.5
const MAX_ELEVATION = 9
/** Stay out from under the stations, so the camera never clips a roof. */
const MIN_STATION_DISTANCE = 22

type Site = { x: number; z: number; y: number }

/** Mean absolute height difference to the four neighbours — lower is flatter. */
function roughness(x: number, z: number, reach = 3): number {
  const here = terrainHeight(x, z)
  return (
    (Math.abs(terrainHeight(x + reach, z) - here) +
      Math.abs(terrainHeight(x - reach, z) - here) +
      Math.abs(terrainHeight(x, z + reach) - here) +
      Math.abs(terrainHeight(x, z - reach) - here)) /
    4
  )
}

function findVillageSite(): Site {
  let best: Site | null = null
  let bestScore = Infinity

  for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx += SEARCH_STEP) {
    for (let dz = -SEARCH_RADIUS; dz <= SEARCH_RADIUS; dz += SEARCH_STEP) {
      const x = PREFERRED.x + dx
      const z = PREFERRED.z + dz
      const y = terrainHeight(x, z)

      if (y < MIN_ELEVATION || y > MAX_ELEVATION) continue
      if (
        allStations.some(
          (s) => (s.position.x - x) ** 2 + (s.position.z - z) ** 2 < MIN_STATION_DISTANCE ** 2,
        )
      ) {
        continue
      }

      // Flatness dominates; distance from the preferred spot only breaks ties.
      const score = roughness(x, z) * 10 + Math.hypot(dx, dz) * 0.05
      if (score < bestScore) {
        bestScore = score
        best = { x, z, y }
      }
    }
  }

  // Nothing suitable: fall back to the preferred point, clamped above water.
  return best ?? { x: PREFERRED.x, z: PREFERRED.z, y: Math.max(terrainHeight(PREFERRED.x, PREFERRED.z), MIN_ELEVATION) }
}

type House = {
  offsetX: number
  offsetZ: number
  width: number
  depth: number
  height: number
  rotation: number
}

const HOUSES: House[] = [
  { offsetX: -5.5, offsetZ: 2.5, width: 3, depth: 2.6, height: 2.4, rotation: 0.25 },
  { offsetX: -2, offsetZ: 6, width: 2.6, depth: 2.4, height: 2.1, rotation: -0.5 },
  { offsetX: 3.5, offsetZ: 5, width: 3.4, depth: 2.8, height: 2.6, rotation: 0.9 },
  { offsetX: 6.5, offsetZ: 0.5, width: 2.4, depth: 2.2, height: 2, rotation: -0.2 },
  { offsetX: 1, offsetZ: -4.5, width: 3, depth: 2.6, height: 2.3, rotation: 1.4 },
  { offsetX: -6, offsetZ: -3.5, width: 2.2, depth: 2.2, height: 1.9, rotation: 0.6 },
]

export function Village({ animate }: { animate: boolean }) {
  const site = useMemo(() => { const s = findVillageSite(); console.log('VILLAGE', JSON.stringify({...s, rough: roughness(s.x,s.z), houses: HOUSES.map(h=>+terrainHeight(s.x+h.offsetX, s.z+h.offsetZ).toFixed(2))})); return s }, [])
  const blades = useRef<THREE.Group>(null)
  const time = useRef(0)

  const wall = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color('#e4d6c0'),
        emissive: new THREE.Color('#3a2f42'),
        emissiveIntensity: 0.4,
        flatShading: true,
      }),
    [],
  )
  const roof = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color('#7d4a5e'),
        emissive: new THREE.Color('#2c1a2e'),
        emissiveIntensity: 0.5,
        flatShading: true,
      }),
    [],
  )
  const window = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color('#ffd9a0'),
        emissive: new THREE.Color('#ffb45c'),
        // Bright enough to catch the bloom: lit windows at dusk are most of
        // what makes a cluster of boxes read as somewhere people live.
        emissiveIntensity: 2.2,
        flatShading: true,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      wall.dispose()
      roof.dispose()
      window.dispose()
    }
  }, [wall, roof, window])

  useFrame((_state, delta) => {
    if (!animate || !blades.current) return
    time.current += Math.min(delta, 1 / 30)
    blades.current.rotation.z = time.current * 0.55
  })

  return (
    <group position={[site.x, 0, site.z]}>
      {HOUSES.map((house, i) => {
        // Each cottage sits on its own patch of ground, not the village's mean
        // height — otherwise half of them float and half are buried.
        const groundY = terrainHeight(site.x + house.offsetX, site.z + house.offsetZ)
        return (
          <group
            key={i}
            position={[house.offsetX, groundY, house.offsetZ]}
            rotation={[0, house.rotation, 0]}
          >
            <mesh material={wall} position={[0, house.height / 2 - 0.2, 0]}>
              <boxGeometry args={[house.width, house.height, house.depth]} />
            </mesh>
            {/* Four-sided hip roof: a pyramid, turned 45° to square up with
                the walls. */}
            <mesh
              material={roof}
              position={[0, house.height + 0.55, 0]}
              rotation={[0, Math.PI / 4, 0]}
            >
              <cylinderGeometry
                args={[0, Math.max(house.width, house.depth) * 0.78, 1.5, 4]}
              />
            </mesh>
            <mesh
              material={window}
              position={[0, house.height * 0.45, house.depth / 2 + 0.02]}
            >
              <boxGeometry args={[0.5, 0.5, 0.08]} />
            </mesh>
          </group>
        )
      })}

      {/* The windmill, on the highest ground in the cluster. */}
      <group position={[0, terrainHeight(site.x, site.z), 0]}>
        <mesh material={wall} position={[0, 4, 0]}>
          <cylinderGeometry args={[1.15, 1.9, 8, 6]} />
        </mesh>
        <mesh material={roof} position={[0, 8.7, 0]} rotation={[0, Math.PI / 6, 0]}>
          <cylinderGeometry args={[0, 1.6, 1.8, 6]} />
        </mesh>
        <mesh material={window} position={[0, 3.2, 1.45]}>
          <boxGeometry args={[0.45, 0.6, 0.1]} />
        </mesh>

        {/* Sails on the front face, turning about the axle. */}
        <group ref={blades} position={[0, 7.2, 1.5]}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <mesh material={wall} position={[0, 2.4, 0]}>
                <boxGeometry args={[0.7, 4.4, 0.12]} />
              </mesh>
            </group>
          ))}
          <mesh material={roof}>
            <cylinderGeometry args={[0.3, 0.3, 0.5, 6]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
