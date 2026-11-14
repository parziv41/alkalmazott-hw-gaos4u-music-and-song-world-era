import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Settlement } from '../types/places'

type GazetteerFile = { columns: string[]; rows: [string, string, string, number, number, number, string][] }

export type Gazetteer = {
  /** Most populous first. */
  all: Settlement[]
  byId: Map<string, Settlement>
  /** Per country (upper-case ISO code), most populous first. */
  byCountry: Map<string, Settlement[]>
}

function index(file: GazetteerFile): Gazetteer {
  const all = file.rows.map(([id, name, iso2, lat, lon, population, region]) => ({ id, name, iso2, lat, lon, population, region }))
  const byCountry = new Map<string, Settlement[]>()
  for (const place of all) {
    const list = byCountry.get(place.iso2)
    if (list) list.push(place)
    else byCountry.set(place.iso2, [place])
  }
  return { all, byId: new Map(all.map((place) => [place.id, place])), byCountry }
}

/**
 * Towns and villages to search for and mark on the globe: every Hungarian settlement, European
 * towns of 15,000+, and the world's cities of 100,000+. About 400 KB, so loaded only when needed.
 */
export const gazetteerQuery = () =>
  queryOptions({
    queryKey: ['gazetteer'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/data/gazetteer.json', { signal })
      if (!response.ok) throw new Error(`Could not load places (${response.status})`)
      return index((await response.json()) as GazetteerFile)
    },
    staleTime: Number.POSITIVE_INFINITY,
  })

export function useGazetteer(enabled: boolean) {
  return useQuery({ ...gazetteerQuery(), enabled })
}
