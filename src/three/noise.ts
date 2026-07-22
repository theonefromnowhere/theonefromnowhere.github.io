/**
 * Seeded 2D simplex noise + fBm, in TypeScript.
 *
 * The terrain is generated on the CPU rather than displaced in a vertex
 * shader, for one reason: the rest of the site needs to know how high the
 * ground is. Station cameras, landmarks and floating debris all sit at
 * `terrainHeight(x, z)`, and that only works if the heightfield is callable
 * from ordinary code.
 *
 * Algorithm after Stefan Gustavson's simplex noise; the permutation table is
 * shuffled from a seeded PRNG so the world is identical on every load.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GRAD2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function buildPermutation(seed: number): Uint8Array {
  const random = mulberry32(seed)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i

  // Fisher-Yates
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = base[i]
    base[i] = base[j]
    base[j] = tmp
  }

  // Doubled so lookups never need a modulo.
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]
  return perm
}

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

export function createNoise2D(seed: number) {
  const perm = buildPermutation(seed)

  return function noise2D(xin: number, yin: number): number {
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)

    const t = (i + j) * G2
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)

    // Which of the two triangles in this simplex cell are we in?
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1

    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255

    let total = 0

    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 > 0) {
      const g = GRAD2[perm[ii + perm[jj]] & 7]
      t0 *= t0
      total += t0 * t0 * (g[0] * x0 + g[1] * y0)
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 > 0) {
      const g = GRAD2[perm[ii + i1 + perm[jj + j1]] & 7]
      t1 *= t1
      total += t1 * t1 * (g[0] * x1 + g[1] * y1)
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 > 0) {
      const g = GRAD2[perm[ii + 1 + perm[jj + 1]] & 7]
      t2 *= t2
      total += t2 * t2 * (g[0] * x2 + g[1] * y2)
    }

    // Scaled to roughly [-1, 1].
    return 70 * total
  }
}

export type Noise2D = ReturnType<typeof createNoise2D>

/** Standard fractional Brownian motion: octaves at doubling frequency. */
export function fbm(
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2.03,
  gain = 0.5,
): number {
  let sum = 0
  let amplitude = 1
  let frequency = 1
  let normalisation = 0

  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency)
    normalisation += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }

  return sum / normalisation
}

/**
 * Ridged noise — the absolute value inverted, so zero-crossings become sharp
 * crests. This is what gives the terrain mountain ridges rather than dunes.
 */
export function ridged(
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2.07,
  gain = 0.5,
): number {
  let sum = 0
  let amplitude = 1
  let frequency = 1
  let normalisation = 0

  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * frequency, y * frequency))
    sum += amplitude * n * n
    normalisation += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }

  return sum / normalisation
}
