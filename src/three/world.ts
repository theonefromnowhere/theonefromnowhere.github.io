import * as THREE from 'three'
import type { Route } from '../lib/navigation'
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
  id: Route
  position: THREE.Vector3
  look: THREE.Vector3
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
   * Screen-space push, in world units, applied at the landmark's distance.
   *
   * As a fraction of the half-width of frame — roughly `distance * 0.89` at a
   * 58° vertical field on a wide viewport — this is how far right of centre
   * the landmark lands. Sections sit near 0.47 and the centred entry panel
   * near 0.73.
   *
   * Note this scales with distance: moving a camera back shrinks the landmark
   * *and* shrinks the screen-space effect of a given offset, so pulling back
   * without raising the offset quietly drags the landmark back toward centre.
   */
  offset: number
  kind: LandmarkKind
  scale: number
  color: string
  emissive: string
}

const SPECS: Record<Route, StationSpec> = {
  home: {
    at: [0, -26],
    camera: [0, 34],
    altitude: 15,
    aim: 7,
    // The entry panel is centred, so the beacon has to clear its right edge.
    offset: 22,
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
    offset: 18,
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
    offset: 18,
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
    offset: 19,
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
    offset: 18,
    kind: 'at',
    scale: 1,
    color: '#a8ffe8',
    emissive: '#3ad6b0',
  },
}

const UP = new THREE.Vector3(0, 1, 0)

function build(id: Route, spec: StationSpec): Station {
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

  // Push the aim point left along the camera's right vector, which swings the
  // landmark to the right of frame.
  const forward = aimPoint.clone().sub(position).normalize()
  const right = forward.clone().cross(UP).normalize()
  const look = aimPoint.clone().addScaledVector(right, -spec.offset)

  return {
    id,
    position,
    look,
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
  Object.entries(SPECS).map(([id, spec]) => [id, build(id as Route, spec)]),
) as Record<Route, Station>

export const allStations = Object.values(stations)

