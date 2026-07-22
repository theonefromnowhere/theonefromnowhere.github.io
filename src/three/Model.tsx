import { useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { useMemo } from 'react'

type GroupProps = ThreeElements['group']

/**
 * The Blender path. Drop a .glb into `public/models/` and render:
 *
 *   <Model url={modelUrl('bust.glb')} scale={2} position={[-2, 0, 0]} />
 *
 * Must be rendered inside the <Suspense> boundary in SceneCanvas — useGLTF
 * suspends while loading.
 */
export function Model({ url, ...props }: { url: string } & GroupProps) {
  // drei defaults the Draco decoder to a gstatic CDN URL. The decoder is
  // vendored into public/draco/ (from three/examples/jsm/libs/draco/gltf/) so
  // the site never reaches out to a third party at runtime.
  const { scene } = useGLTF(url, `${import.meta.env.BASE_URL}draco/`)

  // useGLTF caches by URL, so the same object graph is handed to every caller.
  // Cloning keeps two <Model/> instances of one file from fighting over
  // transforms.
  const object = useMemo(() => scene.clone(true), [scene])

  return <primitive object={object} {...props} />
}

/**
 * Resolves a path under `public/`. GitHub Pages serves the site from a
 * subpath, so a bare '/models/x.glb' 404s there — always go through this.
 */
export function modelUrl(file: string): string {
  return `${import.meta.env.BASE_URL}models/${file}`
}

/** Call at module scope to start the fetch before the mesh is mounted. */
export const preloadModel = (file: string) => useGLTF.preload(modelUrl(file))
