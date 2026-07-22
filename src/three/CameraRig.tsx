import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Route } from '../lib/navigation'
import { pointer } from '../lib/pointer'
import { setTraveling, travel } from '../lib/travel'
import { groundOrSea } from './terrain'
import { stations } from './world'

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
  const { camera, invalidate } = useThree()

  const base = useRef(new THREE.Vector3().copy(stations.home.position))
  const parallax = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3().copy(stations.home.look))
  const arrivalThreshold = useRef(ARRIVAL_FLOOR)
  const departureDistance = useRef(1)
  const arcHeight = useRef(0)
  const arc = useRef(0)

  const scratch = useMemo(
    () => ({ desiredParallax: new THREE.Vector3(), heading: new THREE.Vector3() }),
    [],
  )

  useEffect(() => {
    const target = stations[route]

    if (!animate) {
      // Reduced motion: no flight. Jump, and report arrival immediately.
      base.current.copy(target.position)
      parallax.current.set(0, 0, 0)
      arc.current = 0
      currentLook.current.copy(target.look)
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

  useFrame((_state, delta) => {
    if (!animate) return

    const dt = Math.min(delta, 1 / 30)
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
    currentLook.current.x = THREE.MathUtils.damp(currentLook.current.x, target.look.x, TRAVEL_LAMBDA, dt)
    currentLook.current.y = THREE.MathUtils.damp(currentLook.current.y, target.look.y, TRAVEL_LAMBDA, dt)
    currentLook.current.z = THREE.MathUtils.damp(currentLook.current.z, target.look.z, TRAVEL_LAMBDA, dt)

    // 3. The parallax: an independent offset, so it never perturbs the flight.
    const desired = scratch.desiredParallax.set(
      pointer.x * PARALLAX_RANGE.x,
      -pointer.y * PARALLAX_RANGE.y,
      0,
    )
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, desired.x, PARALLAX_LAMBDA, dt)
    parallax.current.y = THREE.MathUtils.damp(parallax.current.y, desired.y, PARALLAX_LAMBDA, dt)

    // 4. The arc: a parabola over the flight, zero at both ends so it neither
    //    disturbs the departure pose nor the arrival one, and eased so that
    //    redirecting mid-flight bends the path rather than stepping it.
    const desiredArc = Math.sin(Math.PI * travel.progress) * arcHeight.current
    arc.current = THREE.MathUtils.damp(arc.current, desiredArc, ARC_LAMBDA, dt)

    camera.position.set(
      base.current.x + parallax.current.x,
      base.current.y + arc.current + parallax.current.y,
      base.current.z,
    )

    // 5. The floor: whatever the arc decided, stay clear of the ground here and
    //    just ahead, so a descent toward a station cannot clip the ridge in
    //    front of it.
    const heading = scratch.heading
      .copy(target.position)
      .sub(base.current)
      .setY(0)
    if (heading.lengthSq() > 1e-6) heading.normalize().multiplyScalar(LOOKAHEAD)

    const clearance =
      Math.max(
        groundOrSea(camera.position.x, camera.position.z),
        groundOrSea(camera.position.x + heading.x, camera.position.z + heading.z),
      ) + MIN_CLEARANCE

    if (camera.position.y < clearance) camera.position.y = clearance

    camera.lookAt(currentLook.current)
  })

  return null
}
