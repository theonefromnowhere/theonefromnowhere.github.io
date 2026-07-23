import * as THREE from 'three'
import type { StationRoute } from '../lib/navigation'
import { groundOrSea } from './terrain'

/**
 * Where each route lives in the world.
 *
 * A station is defined by two things on the ground plane — where its landmark
 * stands, and where the camera hovers to look at it. Heights come from the
 * terrain itself via `groundOrSea`, so nothing is hand-tuned to a Y value that
 * would silently break the moment the noise seed changes.
 *
 * The aim point is pushed sideways from the landmark so the landmark composes
 * to the right of frame, clear of the panel on the left. Because that push is
 * applied along the camera's own right vector, it holds whichever way the
 * station faces.
 *
 * Cameras are deliberately placed on *different sides* of their landmarks —
 * home looks north, about looks south-east, publications and contact face each
 * other outright. Approaching a station from the wrong side is the point: the
 * camera swings around the landmark to get into position, up to a full 180°
 * between publications and contact, which is what makes the transitions read
 * as flight through a place rather than a dolly down a corridor.
 */

export type LandmarkKind =
  | 'beacon'
  | 'profile'
  | 'hammer'
  | 'galaxy'
  | 'at'

export type Station = {
  id: StationRoute
  position: THREE.Vector3
  /** The point on the landmark the camera is nominally aimed at. */
  aimPoint: THREE.Vector3
  /** See StationSpec.offsetFraction. */
  offsetFraction: number
  landmark: {
    kind: LandmarkKind
    position: THREE.Vector3
    scale: number
    color: string
    emissive: string
  }
}

type StationSpec = {
  /** Landmark footprint on the ground plane. */
  at: [x: number, z: number]
  /** Camera offset from the landmark, in world XZ. */
  camera: [dx: number, dz: number]
  /** How far above the ground the camera hovers. */
  altitude: number
  /** How far above the landmark base the camera aims. */
  aim: number
  /**
   * How far right of centre the landmark sits, as a fraction of half the
   * frame width. 0 is centred, 1 is the right edge.
   *
   * Deliberately a *fraction*, not a world-space distance. The camera's field
   * of view is vertical, so the horizontal extent of the frame grows with the
   * aspect ratio: a fixed world-space offset drifts back toward the centre on
   * wide displays and slides under the panel. `lookTargetFor` resolves this
   * against the live aspect ratio every frame, so the landmark holds its place
   * on screen at any window shape.
   */
  offsetFraction: number
  kind: LandmarkKind
  scale: number
  color: string
  emissive: string
}

const SPECS: Record<StationRoute, StationSpec> = {
  home: {
    at: [0, -26],
    camera: [0, 34],
    altitude: 15,
    aim: 7,
    // The entry panel is centred, so the beacon has to clear its right edge.
    offsetFraction: 0.72,
    kind: 'beacon',
    scale: 1,
    color: '#f2c6e0',
    emissive: '#ff9ecf',
  },
  about: {
    at: [-34, -30],
    camera: [-26, -36],
    altitude: 16,
    aim: 12,
    offsetFraction: 0.55,
    kind: 'profile',
    scale: 1,
    color: '#9fb6ff',
    emissive: '#5f7bff',
  },
  experience: {
    at: [30, -48],
    camera: [37, -21],
    altitude: 15,
    aim: 11,
    // Pushed further right than the other sections: its panel is wider.
    offsetFraction: 0.68,
    kind: 'hammer',
    scale: 1,
    color: '#ffc39b',
    emissive: '#ff8a5c',
  },
  publications: {
    at: [-22, -70],
    camera: [-28, 31],
    altitude: 21,
    aim: 17,
    offsetFraction: 0.55,
    kind: 'galaxy',
    scale: 1,
    color: '#d8c6ff',
    emissive: '#a98bff',
  },
  contact: {
    at: [30, -104],
    camera: [28, -33],
    altitude: 16,
    aim: 12,
    offsetFraction: 0.55,
    kind: 'at',
    scale: 1,
    color: '#a8ffe8',
    emissive: '#3ad6b0',
  },
}

const UP = new THREE.Vector3(0, 1, 0)

function build(id: StationRoute, spec: StationSpec): Station {
  const [lx, lz] = spec.at
  const landmarkPosition = new THREE.Vector3(lx, groundOrSea(lx, lz), lz)

  const cx = lx + spec.camera[0]
  const cz = lz + spec.camera[1]
  // Clear both the landmark's own hill and whatever is under the camera, so a
  // station never ends up looking out from inside a mountain.
  const cameraY = Math.max(
    groundOrSea(cx, cz) + spec.altitude,
    landmarkPosition.y + spec.altitude * 0.55,
  )
  const position = new THREE.Vector3(cx, cameraY, cz)

  const aimPoint = landmarkPosition.clone().setY(landmarkPosition.y + spec.aim)

  return {
    id,
    position,
    aimPoint,
    offsetFraction: spec.offsetFraction,
    landmark: {
      kind: spec.kind,
      position: landmarkPosition,
      scale: spec.scale,
      color: spec.color,
      emissive: spec.emissive,
    },
  }
}

export const stations = Object.fromEntries(
  Object.entries(SPECS).map(([id, spec]) => [id, build(id as StationRoute, spec)]),
) as Record<StationRoute, Station>

/**
 * The path for "enjoy the view": a slow circle over the middle of the world,
 * looking inward and slightly down.
 *
 * The radius is deliberately modest. Orbiting out at the rim would put the
 * subject further away than the fog reaches (FOG_FAR is 98), and the whole
 * thing would be a slow pan across haze.
 */
export const VIEW_ORBIT = {
  centre: new THREE.Vector3(0, 0, -55),
  lookAt: new THREE.Vector3(0, 9, -55),
  radius: 44,
  altitude: 33,
  /** How far the orbit rises and falls either side of `altitude`. */
  altitudeSwing: 9,
  /** Radians per second — a full circuit takes a little over two minutes. */
  speed: 0.05,
}

export const allStations = Object.values(stations)


const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()

/**
 * Where the camera should aim so the station's landmark lands at its intended
 * fraction of the frame.
 *
 * Aiming *beside* the landmark is what pushes it off-centre. The sideways step
 * is computed from the distance, the vertical field of view and the aspect
 * ratio, so it holds the landmark at the same place on screen whatever shape
 * the window is — which a fixed world-space offset cannot do.
 */
export function lookTargetFor(
  station: Station,
  cameraPosition: THREE.Vector3,
  fovDegrees: number,
  aspect: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.copy(station.aimPoint)

  _forward.copy(station.aimPoint).sub(cameraPosition)
  const distance = _forward.length()
  if (distance < 1e-4) return out
  _forward.divideScalar(distance)

  _right.copy(_forward).cross(UP)
  // Degenerate when looking straight down; leave the aim centred rather than
  // producing a NaN that would black out the whole scene.
  if (_right.lengthSq() < 1e-8) return out
  _right.normalize()

  const halfWidth = distance * Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2) * aspect
  return out.addScaledVector(_right, -station.offsetFraction * halfWidth)
}
