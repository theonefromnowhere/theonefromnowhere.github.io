import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SKY_GLOW, SKY_HORIZON, SKY_MID, SKY_TOP } from './ps1'
import fragmentShader from './shaders/sky.frag.glsl'
import vertexShader from './shaders/sky.vert.glsl'

/**
 * Banded gradient dome. It follows the camera every frame so it can be small
 * enough to sit comfortably inside the far plane while still reading as
 * infinitely distant.
 */
export function Sky() {
  const mesh = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(SKY_TOP) },
      uMid: { value: new THREE.Color(SKY_MID) },
      uHorizon: { value: new THREE.Color(SKY_HORIZON) },
      uGlow: { value: new THREE.Color(SKY_GLOW) },
      uBands: { value: 14 },
    }),
    [],
  )

  useFrame((state) => {
    mesh.current?.position.copy(state.camera.position)
  })

  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[180, 24, 16]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}
