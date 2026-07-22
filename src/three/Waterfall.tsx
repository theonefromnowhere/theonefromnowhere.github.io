import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * Water falling from the underside of a flying island.
 *
 * A tapering curtain of triangles, faceted like everything else. Two things
 * make it read as water rather than a blue sheet: the vertex alpha fades to
 * nothing toward the bottom, so it dissolves into mist instead of ending on a
 * hard edge; and a band pattern scrolls downward in the fragment shader, which
 * is what supplies the sense of flow.
 *
 * The colour attribute carries four components, not three — three.js switches
 * on `USE_COLOR_ALPHA` when it sees itemSize 4, which is how the fade gets in
 * without a texture.
 */

const WATER_TOP = new THREE.Color('#dff4ff')
const WATER_BOTTOM = new THREE.Color('#8fc9ef')

type WaterfallOptions = {
  seed: number
  width: number
  length: number
  columns?: number
  rows?: number
}

function buildWaterfallGeometry({
  seed,
  width,
  length,
  columns = 4,
  rows = 14,
}: WaterfallOptions): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()

  // Deterministic wander, so a given island's fall is the same every load.
  const wobbleX = (t: number) => Math.sin(t * 3.4 + seed) * 0.9 + Math.sin(t * 8.1 + seed * 2.3) * 0.3
  const wobbleZ = (t: number) => Math.cos(t * 2.7 + seed * 1.7) * 0.7

  const point = (row: number, col: number) => {
    const t = row / rows
    // Narrows as it falls, then frays out again near the bottom as it breaks up.
    const taper = 1 - 0.55 * t + 0.35 * t * t
    const halfWidth = (width * 0.5) * taper
    const u = col / columns - 0.5

    return new THREE.Vector3(
      u * 2 * halfWidth + wobbleX(t),
      -t * length,
      wobbleZ(t) + u * halfWidth * 0.25,
    )
  }

  const vertexColor = (row: number, col: number, out: THREE.Color) => {
    const t = row / rows
    out.copy(WATER_TOP).lerp(WATER_BOTTOM, t)
    // Per-column brightness variation, so the columns read as separate strands.
    const streak = 0.82 + 0.18 * Math.sin(col * 2.4 + seed)
    out.multiplyScalar(streak)
  }

  const alphaAt = (row: number) => {
    const t = row / rows
    // Fades to nothing: the fall ends in mist rather than a cut edge.
    return 0.92 * Math.pow(1 - t, 1.6)
  }

  const push = (row: number, col: number) => {
    const p = point(row, col)
    positions.push(p.x, p.y, p.z)
    vertexColor(row, col, color)
    colors.push(color.r, color.g, color.b, alphaAt(row))
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // Two triangles per cell, non-indexed so each facet keeps its own normal.
      push(row, col)
      push(row + 1, col)
      push(row + 1, col + 1)

      push(row, col)
      push(row + 1, col + 1)
      push(row, col + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  return geometry
}

type WaterfallProps = {
  seed: number
  /** Local position of the spout, relative to the island. */
  position: [number, number, number]
  width: number
  length: number
  animate: boolean
}

export function Waterfall({ seed, position, width, length, animate }: WaterfallProps) {
  const uniforms = useRef({ uTime: { value: 0 } })

  const geometry = useMemo(
    () => buildWaterfallGeometry({ seed, width, length }),
    [seed, width, length],
  )

  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      // Without this the curtain occludes the water behind it and the strands
      // stop overlapping.
      depthWrite: false,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#4d86b8'),
      emissiveIntensity: 0.55,
      fog: true,
    })

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.current.uTime

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n varying float vFallY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vFallY = position.y;')

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\n uniform float uTime;\n varying float vFallY;',
        )
        // Modulating diffuseColor.a rather than the final gl_FragColor keeps
        // this working regardless of how the output chunk is spelled.
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float band = 0.68 + 0.32 * sin(vFallY * 1.15 + uTime * 5.5);
           diffuseColor.a *= band;`,
        )
    }

    mat.customProgramCacheKey = () => 'waterfall'
    return mat
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_state, delta) => {
    if (!animate) return
    uniforms.current.uTime.value += Math.min(delta, 1 / 30)
  })

  return <mesh geometry={geometry} material={material} position={position} />
}
