import { countriesByIso2 } from '../data'
import type { ChartTrack } from '../types/charts'
import type { Country } from '../types/music'

/** Countries of the artists in the global chart, most hits first. */
export function originCounts(tracks: ChartTrack[]): { country: Country; count: number }[] {
  const counts = new Map<Country, number>()
  for (const track of tracks) {
    const country = track.origin ? countriesByIso2.get(track.origin.toLowerCase()) : undefined
    if (country) counts.set(country, (counts.get(country) ?? 0) + 1)
  }
  return [...counts].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count || a.country.name.localeCompare(b.country.name))
}
