import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight, TERRAIN_CENTER } from './terrain'
import { allStations } from './world'

/**
 * Flocks of birds circling over the land.
 *
 * One InstancedMesh for every bird in the sky, so the whole thing is a single
 * draw call. They are fixed silhouettes — a shallow V, no wingbeat — which at
 * this distance is all that reads anyway.
 *
 * The formation is what sells it. Each flock's centre orbits a point over the
 * land, and members hold offsets relative to that centre, rotated to the
 * heading. Birds on independent paths read as scattered insects; birds holding
 * a loose wedge read as a flock.
 */

/** Birds per flock. */
const FLOCK_SIZE = 18

type Member = {
  offset: THREE.Vector3
  bob: number
  bobPhase: number
  scale: number
}

type Flock = {
  centre: THREE.Vector3
  radius: number
  speed: number
  phase: number
  altitude: number
  members: Member[]
}

/**
 * Orbit centres over land, positioned so the *whole* circle stays clear of
 * every station camera — a bird passing through the near plane is a flicker
 * across the whole screen — but still close enough to one to be seen at all.
 *
 * Altitude is measured against the highest ground the orbit passes over, not
 * the ground at its centre. A fixed height above the centre puts the flock
 * either inside a hill on one side of the circle, or so high that a camera
 * aimed slightly downward at a landmark misses it off the top of frame.
 */
function buildFlocks(count: number): Flock[] {
  let state = 771122335
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  const flocks: Flock[] = []
  let attempts = 0

  while (flocks.length < count && attempts < count * 300) {
    attempts++

    const x = TERRAIN_CENTER.x + (random() * 2 - 1) * 70
    const z = TERRAIN_CENTER.z + (random() * 2 - 1) * 70
    const ground = terrainHeight(x, z)

    // Over land, not open sea.
    if (ground < 2) continue

    const radius = 14 + random() * 18

    const distances = allStations.map((s) => Math.hypot(s.position.x - x, s.position.z - z))
    // Clear of every camera, but within sight of the nearest.
    if (Math.min(...distances) < radius + 18) continue
    if (Math.min(...distances) > 80) continue

    // Highest ground under the circle, sampled around it.
    let ceiling = ground
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2
      ceiling = Math.max(ceiling, terrainHeight(x + Math.cos(t) * radius, z + Math.sin(t) * radius))
    }

    const members: Member[] = []
    for (let i = 0; i < FLOCK_SIZE; i++) {
      // A rough wedge: spread across the heading, trailing behind it.
      const across = (random() * 2 - 1) * 9
      const behind = -Math.abs(across) * 0.7 - random() * 6
      members.push({
        offset: new THREE.Vector3(across, (random() * 2 - 1) * 3.5, behind),
        bob: 0.6 + random() * 1.2,
        bobPhase: random() * Math.PI * 2,
        scale: 0.43 + random() * 0.3,
      })
    }

    flocks.push({
      centre: new THREE.Vector3(x, 0, z),
      radius,
      speed: 0.18 + random() * 0.15,
      phase: random() * Math.PI * 2,
      altitude: ceiling + 7 + random() * 7,
      members,
    })
  }

  return flocks
}

export function Birds({ flocks: flockCount, animate }: { flocks: number; animate: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const elapsed = useRef(0)

  const flocks = useMemo(() => {
    const f = buildFlocks(flockCount)
    console.log('BIRDS', JSON.stringify({ asked: flockCount, got: f.length, birds: f.length * FLOCK_SIZE, highTierWouldGet: buildFlocks(6).length }))
    return f
  }, [flockCount])
  const total = flocks.length * FLOCK_SIZE

  const geometry = useMemo(() => {
    // Two triangles meeting at the body, wings along X, nose at +Z. The raised
    // tips give a shallow dihedral, so the silhouette reads as a bird rather
    // than a dash whenever it is seen edge-on.
    const positions = new Float32Array([
      0, 0, 0.35, 0, 0, -0.35, -1, 0.2, 0,
      0, 0, -0.35, 0, 0, 0.35, 1, 0.2, 0,
    ])

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.computeVertexNormals()
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color('#2b2b52'),
        emissive: new THREE.Color('#191a38'),
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      centre: new THREE.Vector3(),
    }),
    [],
  )

  const write = (time: number) => {
    const instanced = mesh.current
    if (!instanced) return
    const { matrix, position, quaternion, euler, scale, centre } = scratch

    let index = 0

    for (const flock of flocks) {
      const angle = time * flock.speed + flock.phase

      centre.set(
        flock.centre.x + Math.cos(angle) * flock.radius,
        flock.altitude + Math.sin(time * 0.25 + flock.phase) * 2.5,
        flock.centre.z + Math.sin(angle) * flock.radius,
      )

      // Tangent to the orbit — the direction of travel.
      const heading = Math.atan2(-Math.sin(angle), Math.cos(angle))
      const cos = Math.cos(heading)
      const sin = Math.sin(heading)

      for (const member of flock.members) {
        // Rotate the formation offset into the heading, so the wedge stays
        // behind the leader through the turn instead of pivoting around it.
        const ox = member.offset.x * cos + member.offset.z * sin
        const oz = -member.offset.x * sin + member.offset.z * cos

        position.set(
          centre.x + ox,
          centre.y + member.offset.y + Math.sin(time * 1.1 + member.bobPhase) * member.bob,
          centre.z + oz,
        )

        // Yaw to the heading, with a constant bank into the turn.
        euler.set(0, heading, -0.22)
        quaternion.setFromEuler(euler)
        scale.setScalar(member.scale)

        matrix.compose(position, quaternion, scale)
        instanced.setMatrixAt(index++, matrix)
      }
    }

    instanced.count = index
    instanced.instanceMatrix.needsUpdate = true
  }

  // Lay out once, so a paused (reduced-motion) scene still has birds in it.
  useLayoutEffect(() => write(0), [flocks])

  useFrame((_state, delta) => {
    if (!animate) return
    elapsed.current += Math.min(delta, 1 / 30)
    write(elapsed.current)
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, Math.max(total, 1)]}
      frustumCulled={false}
    />
  )
}
