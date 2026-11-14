// Scoring and song choice for the "Where's it from?" quiz.
import type { ChartIndex, ChartTrack } from '../types/charts'
import { songKey } from './songKey'

export const ROUNDS = 10
export const MAX_POINTS = 1000
/** The decades the "When?" mode asks about. */
export const QUIZ_DECADES = Array.from({ length: 11 }, (_, i) => 1900 + i * 10)

/** Where: full points for the right country, about 370 at 1,500 km, next to nothing across the world. */
export function distancePoints(km: number): number {
  return km < 1 ? MAX_POINTS : Math.round(MAX_POINTS * Math.exp(-km / 1500))
}

/** When: the right decade, or partial credit for being one or two decades off. */
export function decadePoints(guess: number, answer: number): number {
  const off = Math.abs(guess - answer) / 10
  return off === 0 ? MAX_POINTS : off === 1 ? 600 : off === 2 ? 300 : 0
}

/** A final score as a share of the best possible one (0–1); the dictionaries turn it into words. */
export function scoreShare(points: number, rounds = ROUNDS): number {
  return Math.min(1, Math.max(0, points / (rounds * MAX_POINTS)))
}

/**
 * Songs worth guessing: in this country's chart but in no more than one other, so the answer isn't
 * a global hit that charts everywhere. Without the index (still loading), every song qualifies.
 */
export function localHits(tracks: ChartTrack[], index: ChartIndex | undefined, iso2: string): ChartTrack[] {
  const playable = tracks.filter((track) => track.deezerId)
  if (!index) return playable
  const elsewhere = new Map<string, number>()
  for (const [country, list] of Object.entries(index.charts)) {
    if (country === iso2) continue
    for (const [, key] of list) elsewhere.set(key, (elsewhere.get(key) ?? 0) + 1)
  }
  return playable.filter((track) => (elsewhere.get(songKey(track.artist, track.title)) ?? 0) <= 1)
}

/** A random item, never one of `avoid` if anything else is left. */
export function pick<T>(items: readonly T[], avoid: ReadonlySet<T> = new Set()): T | undefined {
  const fresh = items.filter((item) => !avoid.has(item))
  const pool = fresh.length ? fresh : items
  return pool[Math.floor(Math.random() * pool.length)]
}
