import { AdaptiveDpr, Preload } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { Route } from '../lib/navigation'
import { detectQuality } from '../lib/quality'
import { supportsWebGL } from '../lib/supportsWebGL'
import { useReducedMotion } from '../lib/useReducedMotion'
import { FOG_COLOR } from './ps1'
import { Scene } from './Scene'
import { lookTargetFor, stations } from './world'

/**
 * Stops the render loop when nothing can be seen — a backgrounded tab. Without
 * this the scene keeps burning GPU (and battery) while the user is elsewhere.
 */
function VisibilityGate() {
  const setFrameloop = useThree((state) => state.setFrameloop)

  useEffect(() => {
    const onVisibility = () => setFrameloop(document.hidden ? 'never' : 'always')
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      setFrameloop('always')
    }
  }, [setFrameloop])

  return null
}

/** Renders one frame in demand mode, after the scene has laid out. */
function RenderOnce({ route }: { route: Route }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    const id = requestAnimationFrame(() => invalidate())
    return () => cancelAnimationFrame(id)
  }, [invalidate, route])
  return null
}

export function SceneCanvas({ route }: { route: Route }) {
  const reducedMotion = useReducedMotion()
  const quality = useMemo(() => detectQuality(), [])
  const cameraConfig = useMemo(
    () => ({
      position: stations.home.position.toArray() as [number, number, number],
      fov: 58,
      near: 0.5,
      far: 400,
    }),
    [],
  )

  // The probe touches the DOM, so it runs after mount rather than during
  // render. Until it resolves, the CSS gradient in .scene-layer is what shows —
  // which is also the permanent fallback if WebGL is unavailable.
  const [webgl, setWebgl] = useState<boolean | null>(null)
  useEffect(() => setWebgl(supportsWebGL()), [])

  if (webgl !== true) {
    return <div className="scene-layer" aria-hidden="true" />
  }

  const animate = !reducedMotion

  return (
    <div className="scene-layer scene-layer--live" aria-hidden="true">
      <Canvas
        frameloop={animate ? 'always' : 'demand'}
        // A fixed fraction of the display resolution, upscaled by the browser
        // with nearest-neighbour (see .scene-layer--live canvas in global.css).
        // The chunky pixels are the point, and they also make the fill cost
        // almost nothing.
        dpr={quality.renderScale}
        // Memoised: R3F re-applies these whenever the object identity changes,
        // which would yank the camera back to home on every route change.
        camera={cameraConfig}
        gl={{
          antialias: false, // the era did not have it, and it fights the snap
          alpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(new THREE.Color(FOG_COLOR), 1)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.15
          camera.lookAt(
            lookTargetFor(
              stations.home,
              camera.position,
              (camera as THREE.PerspectiveCamera).fov,
              (camera as THREE.PerspectiveCamera).aspect,
              new THREE.Vector3(),
            ),
          )
        }}
      >
        <Suspense fallback={null}>
          <Scene route={route} quality={quality} animate={animate} />
          <Preload all />
        </Suspense>

        {quality.postprocessing && (
          <EffectComposer enableNormalPass={false}>
            {/* Generous bloom, low threshold: this is the "dreamy" half of the
                brief, and the emissive landmarks are what it catches. */}
            <Bloom
              intensity={1.15}
              luminanceThreshold={0.45}
              luminanceSmoothing={0.35}
              mipmapBlur
            />
            <Vignette offset={0.22} darkness={0.72} />
          </EffectComposer>
        )}

        <AdaptiveDpr pixelated />
        {animate ? <VisibilityGate /> : <RenderOnce route={route} />}
      </Canvas>
    </div>
  )
}
