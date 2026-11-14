import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import type { Country } from '../types/music'
import type { CountryPlaces, SearchCity } from '../types/places'

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return (await response.json()) as T
}

/** A country's cities, artists and films: a static file written by scripts/build-world-data.ts. */
export function placesQuery(iso2: string) {
  return queryOptions({
    queryKey: ['places', iso2.toLowerCase()],
    queryFn: ({ signal }) => getJson<CountryPlaces>(`/data/places/${iso2.toLowerCase()}.json`, signal),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  })
}

export function usePlaces(country: Country | null) {
  return useQuery({ ...placesQuery(country?.iso2 ?? '-'), enabled: !!country && country.cityCount > 0 })
}

// Stable, so TanStack Query can reuse the combined array while nothing has changed.
const loadedOnly = (results: { data?: CountryPlaces }[]) => results.flatMap((result) => (result.data ? [result.data] : []))

/** Places for every country in view, loaded as the camera moves; already-loaded ones come from the cache. */
export function useManyPlaces(iso2s: string[]): CountryPlaces[] {
  return useQueries({ queries: iso2s.map((iso2) => placesQuery(iso2)), combine: loadedOnly })
}

export function useSearchCities(enabled: boolean) {
  return useQuery({
    queryKey: ['search-cities'],
    queryFn: ({ signal }) => getJson<SearchCity[]>('/data/cities.json', signal),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  })
}
