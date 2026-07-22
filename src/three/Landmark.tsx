import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LandmarkKind, Station } from './world'

/**
 * The structures that mark each station.
 *
 * All of them are built from primitives with their segment counts turned down
 * until the facets show — a six-sided cylinder, a fourteen-segment torus. The
 * emissive term is what lets them carry through the fog and pick up the bloom.
 */

type FormProps = {
  /** The landmark's body material. */
  material: THREE.Material
  /** Lifted, but still the landmark's own colour — for highlights. */
  accent: THREE.Material
  /** Near-white and bright enough to bloom. Use sparingly: at this bloom
   *  threshold anything sizeable in it reads as a blown-out white blob. */
  glow: THREE.Material
  animate: boolean
  /**
   * Yaw, in radians, from the landmark toward its station camera. Forms with a
   * flat face — the ring around the hammer — rotate by this so they present
   * face-on rather than edge-on, whichever side the station is viewed from.
   */
  facing: number
}

function useMaterial(color: string, emissive: string, emissiveIntensity: number) {
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(emissive),
        emissiveIntensity,
        flatShading: true,
      }),
    [color, emissive, emissiveIntensity],
  )

  useEffect(() => () => material.dispose(), [material])
  return material
}

/** Slow rotation + bob, shared by every landmark's floating parts. */
function useDrift(animate: boolean, speed = 1) {
  const ref = useRef<THREE.Group>(null)
  const time = useRef(0)

  useFrame((_state, delta) => {
    if (!animate || !ref.current) return
    time.current += Math.min(delta, 1 / 30) * speed
    ref.current.rotation.y = time.current * 0.25
    ref.current.position.y = Math.sin(time.current * 0.55) * 0.6
  })

  return ref
}

function Beacon({ material, animate }: FormProps) {
  const drift = useDrift(animate, 0.8)
  return (
    <group>
      {/* Tapered six-sided pillar. */}
      <mesh material={material} position={[0, 6, 0]}>
        <cylinderGeometry args={[0.7, 2.4, 12, 6, 1]} />
      </mesh>
      <group ref={drift} position={[0, 15, 0]}>
        <mesh material={material}>
          <octahedronGeometry args={[2.2, 0]} />
        </mesh>
      </group>
      {/* Three stones at the base, so it reads as placed rather than dropped. */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + 0.4
        return (
          <mesh
            key={i}
            material={material}
            position={[Math.cos(angle) * 4.2, 0.6, Math.sin(angle) * 4.2]}
            rotation={[0.2, angle, 0.15]}
          >
            <dodecahedronGeometry args={[1.3, 0]} />
          </mesh>
        )
      })}
    </group>
  )
}

const GLYPH_DEPTH = 1.2

/**
 * Bobs a glyph, and either sways it or turns it right around.
 *
 * `spin` in radians per second turns it continuously about its vertical axis,
 * which carries it edge-on twice per revolution — legible only because the
 * glyphs are extruded, so edge-on is a slab rather than nothing. Keep it slow:
 * the face-on reading is the one that matters, and the quicker it turns the
 * less of the time you get it. `spin = 0` falls back to a shallow sway that
 * never leaves face-on.
 */
function useGlyphFloat(animate: boolean, spin = 0) {
  const ref = useRef<THREE.Group>(null)
  const time = useRef(0)

  useFrame((_state, delta) => {
    if (!animate || !ref.current) return
    time.current += Math.min(delta, 1 / 30)
    ref.current.position.y = Math.sin(time.current * 0.5) * 0.8
    ref.current.rotation.y = spin
      ? time.current * spin
      : Math.sin(time.current * 0.33) * 0.14
  })

  return ref
}

/**
 * The profile glyph: a disc for the head over a dome for the shoulders.
 *
 * Both are low-segment cylinders laid on their side so their circular faces
 * point at the camera — an extruded disc, faceted enough to match everything
 * else. The dome is the same cylinder swept through half a turn.
 *
 * `CylinderGeometry` places its theta sweep as `x = r·sin θ`, `z = r·cos θ`,
 * and the `rotation.x = π/2` that turns the disc to face the camera maps
 * +Z to −Y. So a sweep of θ ∈ [π/2, 3π/2] — not [0, π] — is the half that ends
 * up on top, giving shoulders with a flat bottom edge rather than a profile
 * sliced down one side.
 */
function Profile({ accent, glow, animate, facing }: FormProps) {
  // ~40s per revolution, against the ring's ~29s, so the two never lock into
  // step with each other.
  const float = useGlyphFloat(animate, 0.16)
  const ring = useRef<THREE.Mesh>(null)
  const time = useRef(0)

  useFrame((_state, delta) => {
    if (!animate || !ring.current) return
    time.current += Math.min(delta, 1 / 30)
    ring.current.rotation.z = time.current * 0.22
  })

  return (
    <group position={[0, 12, 0]} rotation={[0, facing, 0]}>
      <group ref={float}>
        {/* Nudged down so the pair reads as centred on the station's aim. */}
        <group position={[0, -1, 0]}>
          <mesh material={accent} position={[0, 3.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.3, 2.3, GLYPH_DEPTH, 12]} />
          </mesh>

          <mesh material={accent} position={[0, -3.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[4.4, 4.4, GLYPH_DEPTH, 14, 1, false, Math.PI / 2, Math.PI]}
            />
          </mesh>
        </group>
      </group>

      {/* Outside the float group, so the ring holds steady while the glyph bobs
          inside it. Few enough tubular segments that its corners make the
          rotation legible — a smooth torus spun about its own axis looks
          static. */}
      <mesh ref={ring} material={glow} position={[0, -1, 0]}>
        <torusGeometry args={[7.6, 0.42, 5, 14]} />
      </mesh>
    </group>
  )
}

/**
 * A hammer hanging at 45°, inside a glowing ring.
 *
 * The nesting is load-bearing: the yaw group is the *parent* of the tilt, so
 * the hammer turns about the world's vertical axis while keeping its 45° lean.
 * Tilting inside a spinning frame would instead wobble the lean around like a
 * gyroscope.
 */
function Hammer({ material, glow, animate, facing }: FormProps) {
  const yaw = useRef<THREE.Group>(null)
  const float = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const time = useRef(0)

  useFrame((_state, delta) => {
    if (!animate) return
    time.current += Math.min(delta, 1 / 30)

    if (yaw.current) yaw.current.rotation.y = time.current * 0.22
    if (float.current) float.current.position.y = Math.sin(time.current * 0.5) * 0.7
    // The torus has few enough segments that its corners make the spin visible.
    if (ring.current) ring.current.rotation.z = time.current * 0.35
  })

  return (
    <group position={[0, 11, 0]}>
      <group ref={float}>
        <group ref={yaw}>
          <group rotation={[0, 0, Math.PI / 4]}>
            <mesh material={material} position={[0, -1.4, 0]}>
              <boxGeometry args={[0.55, 10, 0.55]} />
            </mesh>
            {/* Collar, so the head does not appear to float on the shaft. */}
            <mesh material={material} position={[0, 2.9, 0]}>
              <boxGeometry args={[1.1, 1, 1.1]} />
            </mesh>
            <mesh material={material} position={[0, 4.5, 0]}>
              <boxGeometry args={[4.8, 2.6, 2.6]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Turned to face the station camera, so the ring reads as a circle
          around the hammer rather than a line through it. */}
      <group rotation={[0, facing, 0]}>
        <mesh ref={ring} material={glow} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[7.4, 0.42, 5, 14]} />
        </mesh>
      </group>
    </group>
  )
}

/** Cubes in the galaxy. Split between a dense core and two spiral arms. */
const CORE_CUBES = 10
const ARM_CUBES = 44

type GalaxySeed = {
  position: THREE.Vector3
  scale: number
  axis: THREE.Vector3
  phase: number
  spin: number
}

function buildGalaxy(count: number, core: boolean): GalaxySeed[] {
  // Fixed LCG rather than Math.random, so the galaxy is identical every load.
  let state = core ? 24681357 : 13572468
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  const seeds: GalaxySeed[] = []

  for (let i = 0; i < count; i++) {
    let position: THREE.Vector3
    let scale: number

    if (core) {
      // Bulge: small and tight. It carries the brighter material, so a large
      // one merges into a single glowing mass instead of reading as cubes.
      const r = Math.cbrt(random()) * 1.7
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      position = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.6,
        r * Math.sin(phi) * Math.sin(theta),
      )
      scale = 0.6 + random() * 0.45
    } else {
      // Two logarithmic arms. `t` runs outward, so cubes thin and shrink with
      // radius the way a disc does. The jitter is kept small on purpose —
      // scatter it much more and the spiral stops reading as a spiral.
      const t = i / (count - 1)
      const arm = i % 2
      const angle = arm * Math.PI + t * Math.PI * 2.3 + (random() - 0.5) * 0.24
      const radius = 3 + t * 9.5 + (random() - 0.5) * 0.9
      const thickness = 0.85 * (1 - t) + 0.15

      position = new THREE.Vector3(
        Math.cos(angle) * radius,
        (random() - 0.5) * 2 * thickness,
        Math.sin(angle) * radius,
      )
      scale = 0.78 - t * 0.32 + random() * 0.3
    }

    seeds.push({
      position,
      scale,
      axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      phase: random() * Math.PI * 2,
      spin: 0.15 + random() * 0.4,
    })
  }

  return seeds
}

/**
 * A spiral galaxy of ~50 cubes.
 *
 * Two InstancedMeshes — core and arms — so the bulge can carry the brighter
 * material without needing per-instance colour. The whole thing is tilted and
 * then rotated about its own galactic axis, which is why the disc rotation and
 * the tilt live on separate nested groups.
 */
function Galaxy({ material, accent, animate, facing }: FormProps) {
  const disc = useRef<THREE.Group>(null)
  const coreMesh = useRef<THREE.InstancedMesh>(null)
  const armMesh = useRef<THREE.InstancedMesh>(null)
  const time = useRef(0)

  const core = useMemo(() => buildGalaxy(CORE_CUBES, true), [])
  const arms = useMemo(() => buildGalaxy(ARM_CUBES, false), [])

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
    }),
    [],
  )

  const write = (
    instanced: THREE.InstancedMesh | null,
    seeds: GalaxySeed[],
    t: number,
  ) => {
    if (!instanced) return
    const { matrix, quaternion, scale } = scratch

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]
      quaternion.setFromAxisAngle(seed.axis, t * seed.spin + seed.phase)
      scale.setScalar(seed.scale)
      matrix.compose(seed.position, quaternion, scale)
      instanced.setMatrixAt(i, matrix)
    }

    instanced.instanceMatrix.needsUpdate = true
  }

  // Lay out once, so a paused (reduced-motion) scene still has a galaxy in it.
  useLayoutEffect(() => {
    write(coreMesh.current, core, 0)
    write(armMesh.current, arms, 0)
  }, [core, arms])

  useFrame((_state, delta) => {
    if (!animate) return
    time.current += Math.min(delta, 1 / 30)
    if (disc.current) disc.current.rotation.y = time.current * 0.09
    write(coreMesh.current, core, time.current)
    write(armMesh.current, arms, time.current)
  })

  return (
    // The disc is built in the XZ plane, so from a near-horizontal camera it
    // would be edge-on — a line of cubes. Yawing toward the station and then
    // tilting about the local X axis stands it up and presents it obliquely,
    // which is the only way the spiral is legible.
    <group position={[0, 17, 0]} rotation={[0, facing, 0]}>
      <group rotation={[1.08, 0, 0.14]}>
        <group ref={disc}>
          <instancedMesh
            ref={coreMesh}
            args={[geometry, accent, CORE_CUBES]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={armMesh}
            args={[geometry, material, ARM_CUBES]}
            frustumCulled={false}
          />
        </group>
      </group>
    </group>
  )
}

/**
 * An "@", assembled from torus arcs and two bars.
 *
 * The outer stroke is a partial torus — `TorusGeometry`'s arc parameter sweeps
 * counter-clockwise from +x, so a 292° sweep rolled back by 18° leaves the gap
 * at the lower right, where the glyph's opening belongs. The inner bowl and its
 * right-hand stem make the "a" inside.
 */
function AtSign({ accent, animate, facing }: FormProps) {
  const float = useGlyphFloat(animate)

  return (
    <group position={[0, 12, 0]} rotation={[0, facing, 0]}>
      <group ref={float}>
        <mesh material={accent} rotation={[0, 0, -Math.PI * 0.1]}>
          <torusGeometry args={[5.6, 0.62, 5, 22, Math.PI * 1.62]} />
        </mesh>

        <mesh material={accent}>
          <torusGeometry args={[2.1, 0.55, 5, 16]} />
        </mesh>
        <mesh material={accent} position={[2.1, -0.2, 0]}>
          <boxGeometry args={[0.55, 4.4, 0.6]} />
        </mesh>
        {/* The tail kicking out of the bowl toward the gap. */}
        <mesh
          material={accent}
          position={[2.95, -2.5, 0]}
          rotation={[0, 0, -Math.PI / 4]}
        >
          <boxGeometry args={[0.55, 2.6, 0.6]} />
        </mesh>
      </group>
    </group>
  )
}

const FORMS: Record<LandmarkKind, (props: FormProps) => React.JSX.Element> = {
  beacon: Beacon,
  profile: Profile,
  hammer: Hammer,
  galaxy: Galaxy,
  at: AtSign,
}

export function Landmark({ station, animate }: { station: Station; animate: boolean }) {
  const { landmark } = station
  const material = useMaterial(landmark.color, landmark.emissive, 0.9)
  const accent = useMaterial(landmark.color, landmark.emissive, 1.6)
  const glow = useMaterial('#fff4ea', landmark.emissive, 2.4)
  const Form = FORMS[landmark.kind]

  // Yaw from the landmark toward its station camera.
  const facing = useMemo(() => {
    const dx = station.position.x - landmark.position.x
    const dz = station.position.z - landmark.position.z
    return Math.atan2(dx, dz)
  }, [station.position, landmark.position])

  return (
    <group position={landmark.position} scale={landmark.scale}>
      <Form
        material={material}
        accent={accent}
        glow={glow}
        animate={animate}
        facing={facing}
      />
      {/* A tinted point light per landmark: the structures should feel like the
          only light sources out here besides the sky. Kept low and near the
          ground — raised into a floating landmark it overexposes it. */}
      <pointLight
        position={[0, 5, 0]}
        color={landmark.emissive}
        intensity={110}
        distance={46}
        decay={2}
      />
    </group>
  )
}
