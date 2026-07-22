let cached: boolean | null = null

/**
 * One-time probe for a usable WebGL2 context. Creating a context is not free
 * and some drivers cap the number of live contexts, so the result is cached and
 * the probe canvas is released immediately.
 */
export function supportsWebGL(): boolean {
  if (cached !== null) return cached

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    cached = gl !== null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }

  return cached
}
