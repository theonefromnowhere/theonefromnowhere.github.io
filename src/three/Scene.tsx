import type { Quality } from '../lib/quality'
import type { Route } from '../lib/navigation'
import { CameraRig } from './CameraRig'
import { Islands } from './Islands'
import { Landmark } from './Landmark'
import { FOG_COLOR, FOG_FAR, FOG_NEAR } from './ps1'
import { Shards } from './Shards'
import { Sky } from './Sky'
import { Sea, Terrain } from './TerrainMesh'
import { allStations } from './world'

type SceneProps = {
  route: Route
  quality: Quality
  animate: boolean
}

export function Scene({ route, quality, animate }: SceneProps) {
  return (
    <>
      {/* Heavy, coloured haze. It is doing three jobs: selling the era, hiding
          the edge of the generated terrain, and keeping distant stations from
          competing with the one you are at. */}
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      <Sky />

      {/* No <Environment preset>: drei's presets fetch HDRIs from a CDN at
          runtime, which would break this as a self-contained static site. */}
      <hemisphereLight args={['#aab2ff', '#1c3a30', 1.2]} />
      {/* The warm key is kept low so it grades the greens rather than washing
          them back toward the rose the terrain used to be. */}
      <directionalLight position={[-60, 26, 30]} intensity={1.05} color="#ffcfae" />
      <directionalLight position={[40, 14, -60]} intensity={0.7} color="#8fd8ff" />

      <Terrain segments={quality.terrainSegments} />
      <Sea />
      <Islands animate={animate} />
      <Shards count={quality.shards} animate={animate} />

      {allStations.map((station) => (
        <Landmark key={station.id} station={station} animate={animate} />
      ))}

      <CameraRig route={route} animate={animate} />

      {/* Blender models go here — see src/three/Model.tsx:
          <Model url={modelUrl('your-export.glb')} scale={1.5} /> */}
    </>
  )
}
