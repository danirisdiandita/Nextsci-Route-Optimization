import type { LatLng, VehicleKind } from '../types.ts'

/** Streets wind, so road distance is longer than the straight line. */
const ROAD_FACTOR = 1.3

/** Average city speed in km/h, including traffic. */
export const speedKmh: Record<VehicleKind, number> = { motorbike: 22, car: 25, van: 25 }

/** Straight-line distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_FACTOR
}

/** Whole minutes to drive between two points, at least one unless they are the same place. */
export function driveMinutes(a: LatLng, b: LatLng, kind: VehicleKind): number {
  const km = roadKm(a, b)
  return km === 0 ? 0 : Math.max(1, Math.round((km / speedKmh[kind]) * 60))
}

/** Compass angle of `p` seen from `origin`, in radians from -π to π. */
export function bearing(origin: LatLng, p: LatLng): number {
  return Math.atan2(p.lat - origin.lat, (p.lng - origin.lng) * Math.cos(origin.lat * (Math.PI / 180)))
}

/** A small deterministic hash of a string, for placing points and jitter without randomness. */
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
