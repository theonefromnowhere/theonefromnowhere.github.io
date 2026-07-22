import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { patchWaves, SEA_COLOR } from './ps1'
import { buildTerrainGeometry, SEA_LEVEL, TERRAIN_CENTER, TERRAIN_SIZE } from './terrain'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

/**
 * The ground. Geometry is generated once — it is static for the life of the
 * page, so there is no per-frame CPU cost at all.
 *
 * MeshLambertMaterial rather than Standard: the era had no PBR, and Lambert is
 * both cheaper and closer to the flat, chalky shading of the reference.
 */
export function Terrain({ segments }: { segments: number }) {
  const geometry = useMemo(() => buildTerrainGeometry(segments), [segments])
  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return <mesh geometry={geometry} material={material} receiveShadow={false} />
}

/**
 * The sea. A single low-poly plane with two crossed sines, translucent enough
 * that the terrain under the waterline shows through as depth.
 */
export function Sea() {
  const uniforms = useRef<ReturnType<typeof patchWaves> | null>(null)

  const geometry = useMemo(
    // Few segments on purpose: the waves should visibly step.
    () => new THREE.PlaneGeometry(TERRAIN_SIZE * 1.6, TERRAIN_SIZE * 1.6, 48, 48),
    [],
  )

  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(SEA_COLOR),
      transparent: true,
      opacity: 0.82,
      emissive: new THREE.Color('#101a4d'),
      emissiveIntensity: 0.6,
      side: THREE.DoubleSide,
    })
    uniforms.current = patchWaves(mat, 0.45)
    return mat
  }, [])

  useFrame((_state, delta) => {
    if (uniforms.current) uniforms.current.uTime.value += Math.min(delta, 1 / 30)
  })

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[TERRAIN_CENTER.x, SEA_LEVEL, TERRAIN_CENTER.z]}
    />
  )
}
