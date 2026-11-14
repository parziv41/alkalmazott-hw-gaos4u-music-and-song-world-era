import type { ChartIndex } from '../types/charts'

/** How many of the top songs two countries' charts share. */
export type Neighbour = { iso2: string; shared: number; share: number }

/** Charts differ in length (Apple 25, Shazam 50); compare the top 25 of each. */
export const TOP = 25

/**
 * Every other country, most similar first: the songs both national charts have, as a share of the
 * shorter top 25. Ties go to the country with more songs in common.
 */
export function neighbours(index: ChartIndex | undefined, iso2: string): Neighbour[] {
  const mine = index?.charts[iso2]?.slice(0, TOP)
  if (!index || !mine?.length) return []
  const keys = new Set(mine.map(([, key]) => key))
  const result: Neighbour[] = []
  for (const [other, list] of Object.entries(index.charts)) {
    if (other === iso2) continue
    const theirs = list.slice(0, TOP)
    const shared = theirs.filter(([, key]) => keys.has(key)).length
    result.push({ iso2: other, shared, share: shared / Math.max(1, Math.min(keys.size, theirs.length)) })
  }
  return result.sort((a, b) => b.share - a.share || b.shared - a.shared || a.iso2.localeCompare(b.iso2))
}
