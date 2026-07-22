import * as THREE from 'three'
import { createNoise2D, fbm, ridged, type Noise2D } from './noise'

/**
 * The heightfield, and the faceted geometry built from it.
 *
 * Geometry is deliberately non-indexed: every triangle owns its three vertices,
 * so `computeVertexNormals()` produces one normal per face and each face can
 * carry a single flat colour. That is what makes it read as PS1-era low-poly
 * rather than a smooth modern mesh.
 */

export const WORLD_SEED = 20260722

/**
 * Extent of the generated terrain, centred on TERRAIN_CENTER. Comfortably
 * wider than the fog reaches, so the edge of the world is never in shot.
 */
export const TERRAIN_SIZE = 250
export const TERRAIN_CENTER = new THREE.Vector3(0, 0, -44)
/** Grid cells per side. Higher is finer — and less low-poly. */
export const TERRAIN_SEGMENTS = 118

/** The dream sea sits at y = 0; anything below it is underwater. */
export const SEA_LEVEL = 0

const noise: Noise2D = createNoise2D(WORLD_SEED)

/**
 * Ground height at a world position.
 *
 * Three layers: broad continent shape, rolling hills, and ridged mountains
 * masked so they only appear where the continent is already high. The mask is
 * what keeps ridges off the shoreline, where they would look like noise.
 */
export function terrainHeight(x: number, z: number): number {
  const continent = fbm(noise, x * 0.0065, z * 0.0065, 3)
  const hills = fbm(noise, x * 0.021, z * 0.021, 4)
  const mountains = ridged(noise, x * 0.014, z * 0.014, 4)

  // 0 at the coast, 1 well inland — gates the mountains.
  const mask = THREE.MathUtils.smoothstep(continent, -0.05, 0.42)

  return continent * 13 + hills * 3.6 + mountains * mask * 17 - 3.4
}

/** Height clamped to the sea surface — for placing things that float. */
export function groundOrSea(x: number, z: number): number {
  return Math.max(terrainHeight(x, z), SEA_LEVEL)
}

/**
 * Height of the sea surface at a world position and time.
 *
 * This duplicates, in JavaScript, the two sines the sea's vertex shader adds
 * (see `patchWaves` in ps1.ts). It exists so that anything floating — the
 * ships — rides the same water the shader draws. **The frequencies, speeds and
 * amplitude below must stay in step with that shader**, or boats will bob out
 * of phase with the waves under them.
 *
 * The sea is a plane authored in XY and rotated by -90° about X, which maps
 * local (x, y) to world (x, -z) relative to the terrain centre — hence the
 * negated Z.
 */
export const SEA_WAVE_AMPLITUDE = 0.45

export function seaHeightAt(x: number, z: number, time: number): number {
  const localX = x - TERRAIN_CENTER.x
  const localY = -(z - TERRAIN_CENTER.z)
  const wave =
    Math.sin(localX * 0.08 + time * 0.7) + Math.sin(localY * 0.11 - time * 0.55)
  return SEA_LEVEL + wave * SEA_WAVE_AMPLITUDE
}

/**
 * The palette. A green dream coast under a violet dusk: teal shallows through
 * moss and meadow, turning violet only at the peaks where the sky reaches them.
 * Deliberately few, saturated steps — a smooth gradient would lose the era.
 */
const RAMP: Array<{ stop: number; color: THREE.Color }> = [
  { stop: -8, color: new THREE.Color('#0d2b3a') },
  { stop: -2, color: new THREE.Color('#154a48') },
  { stop: 1.5, color: new THREE.Color('#1f6b4f') },
  { stop: 5, color: new THREE.Color('#358a58') },
  { stop: 9, color: new THREE.Color('#5aa465') },
  { stop: 13, color: new THREE.Color('#87b878') },
  { stop: 17, color: new THREE.Color('#a89ec4') },
  { stop: 22, color: new THREE.Color('#ddd2ef') },
]

const rampScratch = new THREE.Color()

function sampleRamp(height: number, out: THREE.Color): THREE.Color {
  if (height <= RAMP[0].stop) return out.copy(RAMP[0].color)

  for (let i = 1; i < RAMP.length; i++) {
    if (height <= RAMP[i].stop) {
      const span = RAMP[i].stop - RAMP[i - 1].stop
      const t = (height - RAMP[i - 1].stop) / span
      return out.copy(RAMP[i - 1].color).lerp(RAMP[i].color, t)
    }
  }

  return out.copy(RAMP[RAMP.length - 1].color)
}

/**
 * Builds the faceted terrain mesh.
 *
 * Colour is decided per triangle from the centroid height, then darkened by
 * steepness so cliff faces separate from the plateaus above them, and finally
 * nudged by a tiny deterministic jitter — the irregularity reads as the colour
 * banding of a 15-bit framebuffer.
 */
export function buildTerrainGeometry(segments = TERRAIN_SEGMENTS): THREE.BufferGeometry {
  const half = TERRAIN_SIZE / 2
  const step = TERRAIN_SIZE / segments

  const triangleCount = segments * segments * 2
  const positions = new Float32Array(triangleCount * 3 * 3)
  const colors = new Float32Array(triangleCount * 3 * 3)

  // Height is sampled once per grid vertex and reused by the four faces that
  // touch it — sampling per triangle vertex would cost 6x for identical values.
  const gridSize = segments + 1
  const heights = new Float32Array(gridSize * gridSize)
  for (let iz = 0; iz < gridSize; iz++) {
    for (let ix = 0; ix < gridSize; ix++) {
      const x = TERRAIN_CENTER.x - half + ix * step
      const z = TERRAIN_CENTER.z - half + iz * step
      heights[iz * gridSize + ix] = terrainHeight(x, z)
    }
  }

  const color = new THREE.Color()
  const edgeA = new THREE.Vector3()
  const edgeB = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()

  let p = 0
  let c = 0

  const emitTriangle = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ) => {
    positions[p++] = ax; positions[p++] = ay; positions[p++] = az
    positions[p++] = bx; positions[p++] = by; positions[p++] = bz
    positions[p++] = cx; positions[p++] = cy; positions[p++] = cz

    const centroidY = (ay + by + cy) / 3
    sampleRamp(centroidY, color)

    // Steepness: 1 for a flat top, 0 for a vertical wall.
    edgeA.set(bx - ax, by - ay, bz - az)
    edgeB.set(cx - ax, cy - ay, cz - az)
    faceNormal.copy(edgeA).cross(edgeB).normalize()
    const flatness = Math.abs(faceNormal.y)
    color.multiplyScalar(0.55 + 0.45 * flatness)

    // Deterministic per-face tint jitter — cheap hash off the centroid.
    const hash = Math.sin(ax * 12.9898 + az * 78.233) * 43758.5453
    const jitter = 0.94 + 0.12 * (hash - Math.floor(hash))
    rampScratch.copy(color).multiplyScalar(jitter)

    for (let k = 0; k < 3; k++) {
      colors[c++] = rampScratch.r
      colors[c++] = rampScratch.g
      colors[c++] = rampScratch.b
    }
  }

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const x0 = TERRAIN_CENTER.x - half + ix * step
      const x1 = x0 + step
      const z0 = TERRAIN_CENTER.z - half + iz * step
      const z1 = z0 + step

      const h00 = heights[iz * gridSize + ix]
      const h10 = heights[iz * gridSize + ix + 1]
      const h01 = heights[(iz + 1) * gridSize + ix]
      const h11 = heights[(iz + 1) * gridSize + ix + 1]

      // Alternating diagonal per cell breaks up the regular grain that a
      // uniform diagonal leaves across a low-poly field.
      if ((ix + iz) % 2 === 0) {
        emitTriangle(x0, h00, z0, x0, h01, z1, x1, h11, z1)
        emitTriangle(x0, h00, z0, x1, h11, z1, x1, h10, z0)
      } else {
        emitTriangle(x0, h00, z0, x0, h01, z1, x1, h10, z0)
        emitTriangle(x1, h10, z0, x0, h01, z1, x1, h11, z1)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  // Non-indexed, so this yields one normal per face — the faceted look.
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  return geometry
}
