import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { groundOrSea, TERRAIN_CENTER, TERRAIN_SIZE } from './terrain'

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

    for (let i = 0; i < count; i++) {
      const x = TERRAIN_CENTER.x + (random() * 2 - 1) * half
      const z = TERRAIN_CENTER.z + (random() * 2 - 1) * half
      // Float well above whatever is underneath, so nothing intersects a peak.
      const y = groundOrSea(x, z) + 6 + random() * 34

      list.push({
        base: new THREE.Vector3(x, y, z),
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
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  )
}
