import { angleBetween } from './globe'
import type { City, Settlement } from '../types/places'

const EARTH_KM = 6371
/** Lowercase without accents, so "pecs" finds Pécs. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function distanceKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  return angleBetween(a.lon, a.lat, b.lon, b.lat) * EARTH_KM
}

/** The music city that is this settlement: the same Wikidata item, or the same name within 30 km. */
export function cityFor(place: Settlement, cities: City[]): City | undefined {
  const name = fold(place.name)
  return (
    cities.find((city) => city.id === place.id) ??
    cities.find((city) => fold(city.name) === name && distanceKm(city, place) < 30)
  )
}

/** The closest city with artists, films or a chart, for places that have none themselves. */
export function nearestCity(place: { lon: number; lat: number }, cities: City[]): { city: City; km: number } | undefined {
  let best: { city: City; km: number } | undefined
  for (const city of cities) {
    const km = distanceKm(place, city)
    if (!best || km < best.km) best = { city, km }
  }
  return best
}

export type Box = { x: number; y: number; width: number; height: number }
export type LabelCandidate = { id: string; name: string; x: number; y: number }

/** The space a name takes: the dot, then the text to its right. */
export const labelBox = ({ x, y, name }: LabelCandidate, charWidth = 6.2): Box => ({ x: x - 4, y: y - 9, width: 14 + name.length * charWidth, height: 18 })

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * Picks which settlement names fit on screen: candidates arrive most populous first, and each
 * label (to the right of its dot) is kept only if it overlaps nothing already placed.
 */
export function placeLabels(candidates: LabelCandidate[], occupied: Box[], max: number): LabelCandidate[] {
  const taken = [...occupied]
  const placed: LabelCandidate[] = []
  for (const candidate of candidates) {
    const box = labelBox(candidate)
    if (taken.some((other) => overlaps(box, other))) continue
    taken.push(box)
    placed.push(candidate)
    if (placed.length === max) break
  }
  return placed
}
