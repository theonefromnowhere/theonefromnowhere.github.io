import * as THREE from 'three'

/**
 * Retro look and palette.
 *
 * What carries the era here is flat-shaded untextured facets, a low internal
 * resolution upscaled with nearest-neighbour, banded gradients and heavy
 * coloured fog. Vertex snapping — the wobble the console's integer rasteriser
 * produced — was tried and removed: it reads as a rendering fault on a modern
 * display rather than as period charm.
 */

export type WaveUniforms = {
  uTime: { value: number }
  uWaveAmp: { value: number }
}

/**
 * Adds a gentle two-sine displacement to a built-in material, for the sea.
 *
 * Injected into MeshLambertMaterial rather than written as a standalone
 * ShaderMaterial so that fog and lighting keep working for free.
 *
 * Returns the uniform objects it injected, so the caller can drive uTime from
 * useFrame — they are handed to the compiled shader by reference, so mutating
 * them afterwards works.
 */
export function patchWaves(
  material: THREE.Material,
  waveAmplitude = 0.45,
): WaveUniforms {
  const uniforms: WaveUniforms = {
    uTime: { value: 0 },
    uWaveAmp: { value: waveAmplitude },
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uWaveAmp = uniforms.uWaveAmp

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       uniform float uWaveAmp;`,
    )

    // The plane is authored in XY and rotated into place, so its local +Z is
    // up. Deliberately long wavelengths — this is a dream sea, not a
    // simulation.
    //
    // `seaHeightAt` in terrain.ts mirrors these two sines so that floating
    // objects ride the water. Change the numbers here and change them there.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float wave = sin(position.x * 0.08 + uTime * 0.7)
                  + sin(position.y * 0.11 - uTime * 0.55);
       transformed.z += wave * uWaveAmp;`,
    )
  }

  // Distinguishes the patched program from an unpatched one in three's cache.
  material.customProgramCacheKey = () => 'waves'

  return uniforms
}

/* ---------- palette ---------- */

/** Sky gradient: a blue-violet dusk over a green dream coast. */
export const SKY_TOP = '#0b0a2b'
export const SKY_MID = '#312f7d'
export const SKY_HORIZON = '#7378cc'
export const SKY_GLOW = '#b3a6ff'

/**
 * Distance haze. Matches the horizon so terrain dissolves into the sky, and is
 * set well inside the terrain's half-width so the generated edge never
 * resolves — the world should end in haze, not at a visible border.
 */
export const FOG_COLOR = '#585ba8'
export const FOG_NEAR = 22
export const FOG_FAR = 98

export const SEA_COLOR = '#1b4a5e'
