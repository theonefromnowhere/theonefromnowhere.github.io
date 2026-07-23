import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Route } from '../lib/navigation'
import { pointer } from '../lib/pointer'
import { setTraveling, travel } from '../lib/travel'
import { groundOrSea } from './terrain'
import { lookTargetFor, stations, VIEW_ORBIT } from './world'

/** Exponential-decay rate for the flight. Higher is snappier. */
const TRAVEL_LAMBDA = 1.9
/** Rate for the pointer parallax, which should feel lighter than the flight. */
const PARALLAX_LAMBDA = 2.6
/** How far the pointer can push the camera, in world units. */
const PARALLAX_RANGE = new THREE.Vector3(1.6, 1.0, 0)

/**
 * Arrival threshold, as a fraction of the distance travelled.
 *
 * Exponential damping never actually reaches its target, and the tail is long:
 * covering the last 0.1 units of a 57-unit flight takes as long as the first
 * fifty. A relative threshold opens the panel when the camera has visually
 * settled — about two seconds in — instead of nine seconds later when the
 * maths finally agrees.
 */
const ARRIVAL_FRACTION = 0.015
const ARRIVAL_FLOOR = 0.35

/**
 * The flight arcs over the landscape instead of cutting a straight line
 * through it. Two mechanisms, because either alone is insufficient:
 *
 *  - a parabolic lift, scaled to the distance travelled, which climbs out and
 *    settles back down and is what makes the movement read as flight;
 *  - a hard clearance floor sampled from the heightfield under the camera and
 *    a little ahead of it, which is what actually guarantees the camera never
 *    ends up inside a mountain, arc or no arc.
 */
const ARC_FACTOR = 0.3
const MAX_ARC = 28
const MIN_CLEARANCE = 6
/**
 * The arc is eased rather than applied directly. Interrupting a flight
 * recomputes the arc height from the new, shorter distance, and the desired
 * lift can drop a long way in one frame — easing it means an interruption
 * bends the path instead of stepping it.
 */
const ARC_LAMBDA = 2.2
/** Easing toward the cinematic orbit. Slower than a flight — it should drift. */
const VIEW_LAMBDA = 0.9
/** How far ahead to sample the ground, so descents clear the ridge in front. */
const LOOKAHEAD = 9

type CameraRigProps = {
  route: Route
  animate: boolean
}

/**
 * Flies the camera between stations.
 *
 * Damping rather than a keyframed path, for one reason: it is interruptible by
 * construction. Click a second section mid-flight and the camera simply eases
 * toward the new target from wherever it is — no path to recompute, no
 * transition to cancel, and it can never overshoot.
 *
 * The flight and the pointer parallax are kept on separate vectors and summed
 * at the end. Damping the camera's own position toward "itself plus an offset"
 * would feed the offset back in every frame, so the camera would creep away
 * from the station and the arrival test would never settle.
 */
export function CameraRig({ route, animate }: CameraRigProps) {
  const { invalidate } = useThree()
  // The default camera is always the perspective one configured in
  // SceneCanvas; the store types it as the union of both kinds.
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera

  const base = useRef(new THREE.Vector3().copy(stations.home.position))
  const parallax = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3().copy(stations.home.aimPoint))
  const arrivalThreshold = useRef(ARRIVAL_FLOOR)
  const departureDistance = useRef(1)
  const arcHeight = useRef(0)
  const arc = useRef(0)
  /** Elapsed time and starting angle for the cinematic orbit. */
  const viewTime = useRef(0)
  const viewPhase = useRef(0)

  const scratch = useMemo(
    () => ({
      desiredParallax: new THREE.Vector3(),
      heading: new THREE.Vector3(),
      look: new THREE.Vector3(),
      orbit: new THREE.Vector3(),
    }),
    [],
  )

  useEffect(() => {
    if (route === 'view') {
      // Enter the orbit at whichever point is nearest the camera's current
      // position, so switching into the mode drifts sideways into the circle
      // rather than swinging all the way round to a fixed start.
      viewTime.current = 0
      viewPhase.current = Math.atan2(
        base.current.z - VIEW_ORBIT.centre.z,
        base.current.x - VIEW_ORBIT.centre.x,
      )
      travel.progress = 1
      setTraveling(false)

      if (!animate) {
        base.current.set(
          VIEW_ORBIT.centre.x + Math.cos(viewPhase.current) * VIEW_ORBIT.radius,
          VIEW_ORBIT.altitude,
          VIEW_ORBIT.centre.z + Math.sin(viewPhase.current) * VIEW_ORBIT.radius,
        )
        arc.current = 0
        parallax.current.set(0, 0, 0)
        currentLook.current.copy(VIEW_ORBIT.lookAt)
        camera.position.copy(base.current)
        camera.lookAt(currentLook.current)
        invalidate()
      }
      return
    }

    const target = stations[route]

    if (!animate) {
      // Reduced motion: no flight. Jump, and report arrival immediately.
      base.current.copy(target.position)
      parallax.current.set(0, 0, 0)
      arc.current = 0
      lookTargetFor(target, target.position, camera.fov, camera.aspect, currentLook.current)
      camera.position.copy(target.position)
      camera.lookAt(currentLook.current)
      travel.progress = 1
      setTraveling(false)
      invalidate()
      return
    }

    // Measured from wherever the camera is right now, so interrupting a flight
    // simply re-aims it from its current position rather than restarting.
    const distance = base.current.distanceTo(target.position)
    departureDistance.current = Math.max(distance, 0.001)
    arrivalThreshold.current = Math.max(distance * ARRIVAL_FRACTION, ARRIVAL_FLOOR)
    arcHeight.current = Math.min(distance * ARC_FACTOR, MAX_ARC)

    if (distance <= arrivalThreshold.current) {
      travel.progress = 1
      setTraveling(false)
    } else {
      travel.progress = 0
      setTraveling(true)
    }
  }, [route, animate, camera, invalidate])

  /**
   * The part of the frame that is the same whether the camera is flying to a
   * station or drifting round the cinematic orbit: ease the aim, add the
   * pointer parallax, and hold the camera above the ground.
   *
   * The caller sets `scratch.heading` to the direction of travel (it is
   * normalised here) — the ground is sampled under the camera *and* a little
   * ahead of it, so a descent cannot clip the ridge in front.
   */
  const applyLook = (dt: number, desiredLook: THREE.Vector3, lambda: number) => {
    currentLook.current.x = THREE.MathUtils.damp(currentLook.current.x, desiredLook.x, lambda, dt)
    currentLook.current.y = THREE.MathUtils.damp(currentLook.current.y, desiredLook.y, lambda, dt)
    currentLook.current.z = THREE.MathUtils.damp(currentLook.current.z, desiredLook.z, lambda, dt)

    // An independent offset, so the pointer never perturbs the path itself.
    const desired = scratch.desiredParallax.set(
      pointer.x * PARALLAX_RANGE.x,
      -pointer.y * PARALLAX_RANGE.y,
      0,
    )
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, desired.x, PARALLAX_LAMBDA, dt)
    parallax.current.y = THREE.MathUtils.damp(parallax.current.y, desired.y, PARALLAX_LAMBDA, dt)

    camera.position.set(
      base.current.x + parallax.current.x,
      base.current.y + arc.current + parallax.current.y,
      base.current.z,
    )

    const heading = scratch.heading
    if (heading.lengthSq() > 1e-6) heading.normalize().multiplyScalar(LOOKAHEAD)

    const clearance =
      Math.max(
        groundOrSea(camera.position.x, camera.position.z),
        groundOrSea(camera.position.x + heading.x, camera.position.z + heading.z),
      ) + MIN_CLEARANCE

    if (camera.position.y < clearance) camera.position.y = clearance

    camera.lookAt(currentLook.current)
  }

  useFrame((_state, delta) => {
    if (!animate) return

    const dt = Math.min(delta, 1 / 30)

    if (route === 'view') {
      viewTime.current += dt
      const angle = viewPhase.current + viewTime.current * VIEW_ORBIT.speed

      const orbit = scratch.orbit.set(
        VIEW_ORBIT.centre.x + Math.cos(angle) * VIEW_ORBIT.radius,
        // A slow rise and fall, so the circuit does not read as a turntable.
        VIEW_ORBIT.altitude + Math.sin(viewTime.current * 0.085) * VIEW_ORBIT.altitudeSwing,
        VIEW_ORBIT.centre.z + Math.sin(angle) * VIEW_ORBIT.radius,
      )

      base.current.x = THREE.MathUtils.damp(base.current.x, orbit.x, VIEW_LAMBDA, dt)
      base.current.y = THREE.MathUtils.damp(base.current.y, orbit.y, VIEW_LAMBDA, dt)
      base.current.z = THREE.MathUtils.damp(base.current.z, orbit.z, VIEW_LAMBDA, dt)

      scratch.look.copy(VIEW_ORBIT.lookAt)
      // The heading is used only by the ground-clearance lookahead below.
      scratch.heading.set(-Math.sin(angle), 0, Math.cos(angle))
      arc.current = THREE.MathUtils.damp(arc.current, 0, ARC_LAMBDA, dt)

      applyLook(dt, scratch.look, VIEW_LAMBDA)
      return
    }

    const target = stations[route]

    // 1. The flight: base position eases toward the station.
    base.current.x = THREE.MathUtils.damp(base.current.x, target.position.x, TRAVEL_LAMBDA, dt)
    base.current.y = THREE.MathUtils.damp(base.current.y, target.position.y, TRAVEL_LAMBDA, dt)
    base.current.z = THREE.MathUtils.damp(base.current.z, target.position.z, TRAVEL_LAMBDA, dt)

    const remaining = base.current.distanceTo(target.position)
    travel.progress = THREE.MathUtils.clamp(
      1 - remaining / departureDistance.current,
      0,
      1,
    )

    // Report arrival, but never snap the camera to the target: the jump — up to
    // the threshold in a single frame — is exactly the bump at the end of the
    // move. Damping carries it the rest of the way, imperceptibly.
    if (remaining <= arrivalThreshold.current) setTraveling(false)

    // 2. The aim: damped too, otherwise the camera swings to face the
    //    destination on the first frame and the flight reads as a whip pan.
    // Resolved every frame rather than baked into the station, so the aim
    // tracks the aspect ratio as the window is resized.
    const desiredLook = lookTargetFor(
      target,
      base.current,
      camera.fov,
      camera.aspect,
      scratch.look,
    )
    // 3. The arc: a parabola over the flight, zero at both ends so it neither
    //    disturbs the departure pose nor the arrival one, and eased so that
    //    redirecting mid-flight bends the path rather than stepping it.
    const desiredArc = Math.sin(Math.PI * travel.progress) * arcHeight.current
    arc.current = THREE.MathUtils.damp(arc.current, desiredArc, ARC_LAMBDA, dt)

    scratch.heading.copy(target.position).sub(base.current).setY(0)

    applyLook(dt, desiredLook, TRAVEL_LAMBDA)
  })

  return null
}
