import { lazy, Suspense, useEffect } from 'react'
import { Stage } from './components/Stage'
import { startPointerTracking } from './lib/pointer'
import { useRoute } from './lib/navigation'

// three + drei + postprocessing is ~250kB gzipped — far more than the content
// layer. Splitting it out lets the panel paint immediately; until the chunk
// arrives the fallback is the same CSS gradient used when WebGL is missing.
const SceneCanvas = lazy(() =>
  import('./three/SceneCanvas').then((m) => ({ default: m.SceneCanvas })),
)

export function App() {
  const route = useRoute()

  // Registered once, at the top, so the scene sees the same values no matter
  // which components mount and unmount underneath.
  useEffect(() => startPointerTracking(), [])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Suspense fallback={<div className="scene-layer" aria-hidden="true" />}>
        <SceneCanvas route={route} />
      </Suspense>

      <main id="main">
        <Stage />
      </main>
    </>
  )
}
