import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { groundOrSea, TERRAIN_CENTER, TERRAIN_SIZE } from './terrain'
import { allStations } from './world'

/**
 * Rocks adrift above the landscape. One InstancedMesh, so the whole field is a
 * single draw call, and the transforms are written through scratch objects —
 * allocating inside useFrame would churn the collector every frame.
 *
 * They exist for parallax: without something between the camera and the
 * terrain, flying between stations reads as a zoom rather than as travel.
 */

type Seed = {
  base: THREE.Vector3
  axis: THREE.Vector3
  phase: number
  speed: number
  scale: number
}

/**
 * Radius of the clear tube kept along each station's line of sight. Generous,
 * because the rocks bob and slowly drift, so anything merely *near* the line
 * will wander onto it.
 */
const SIGHTLINE_RADIUS = 14
/** Carry the tube past the landmark, so nothing sits directly behind it. */
const SIGHTLINE_OVERSHOOT = 1.35

const _segment = new THREE.Vector3()
const _toPoint = new THREE.Vector3()

/** Perpendicular distance from a point to a station's camera-to-landmark line. */
function blocksASightline(point: THREE.Vector3): boolean {
  for (const station of allStations) {
    _segment.copy(station.aimPoint).sub(station.position).multiplyScalar(SIGHTLINE_OVERSHOOT)
    const lengthSq = _segment.lengthSq()
    if (lengthSq < 1e-6) continue

    _toPoint.copy(point).sub(station.position)
    // Projection parameter along the segment, clamped to its ends.
    const t = Math.min(1, Math.max(0, _toPoint.dot(_segment) / lengthSq))

    _segment.multiplyScalar(t).add(station.position)
    if (point.distanceTo(_segment) < SIGHTLINE_RADIUS) return true
  }

  return false
}

export function Shards({ count, animate }: { count: number; animate: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const seeds = useMemo<Seed[]>(() => {
    // Deterministic layout: a fixed LCG rather than Math.random, so the world
    // looks the same on every load.
    let state = 987654321
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }

    const half = (TERRAIN_SIZE * 0.85) / 2
    const list: Seed[] = []
    const candidate = new THREE.Vector3()

    let attempts = 0
    while (list.length < count && attempts < count * 60) {
      attempts++

      const x = TERRAIN_CENTER.x + (random() * 2 - 1) * half
      const z = TERRAIN_CENTER.z + (random() * 2 - 1) * half
      // Float well above whatever is underneath, so nothing intersects a peak.
      const y = groundOrSea(x, z) + 6 + random() * 34

      // Keep the sightlines clear. A rock drifting between a station camera and
      // its landmark is right in the middle of the shot, and at these distances
      // even a small one covers a lot of it.
      candidate.set(x, y, z)
      if (blocksASightline(candidate)) continue

      list.push({
        base: candidate.clone(),
        axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
        phase: random() * Math.PI * 2,
        speed: 0.08 + random() * 0.18,
        scale: 0.35 + random() * 1.5,
      })
    }

    return list
  }, [count])

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
    }),
    [],
  )

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color('#6f74b8'),
      emissive: new THREE.Color('#1e1f44'),
      emissiveIntensity: 0.8,
      flatShading: true,
    })
    return mat
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const elapsed = useRef(0)

  const write = (time: number) => {
    const instanced = mesh.current
    if (!instanced) return
    const { matrix, position, quaternion, scale } = scratch

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]
      const bob = Math.sin(time * seed.speed + seed.phase)

      position.copy(seed.base)
      position.y += bob * 1.4

      quaternion.setFromAxisAngle(seed.axis, time * seed.speed * 0.6 + seed.phase)
      scale.setScalar(seed.scale)

      matrix.compose(position, quaternion, scale)
      instanced.setMatrixAt(i, matrix)
    }

    instanced.instanceMatrix.needsUpdate = true
  }

  // Lay out once, so a paused (reduced-motion) scene still has rocks in it.
  useLayoutEffect(() => write(0), [seeds])

  useFrame((_state, delta) => {
    if (!animate) return
    elapsed.current += Math.min(delta, 1 / 30)
    write(elapsed.current)
  })

  return (
    // Sized to the seeds actually accepted, not the requested count: rejected
    // candidates would otherwise leave surplus instances sitting at the world
    // origin with identity matrices.
    <instancedMesh
      ref={mesh}
      args={[geometry, material, Math.max(seeds.length, 1)]}
      frustumCulled={false}
    />
  )
}
