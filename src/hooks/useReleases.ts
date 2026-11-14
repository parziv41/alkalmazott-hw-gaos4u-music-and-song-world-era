import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { browserFetcher, searchReleases } from '../services/discogsApi'
import type { Country, Genre } from '../types/music'

export const DAY = 24 * 60 * 60 * 1000

function releasesQuery(country: Country, genre: Genre) {
  return queryOptions({
    queryKey: ['releases', country.id, genre.id],
    queryFn: ({ signal }) => searchReleases(country, genre, browserFetcher, signal),
    staleTime: DAY,
    gcTime: DAY,
  })
}

export function useReleases(country: Country, genre: Genre) {
  return useQuery(releasesQuery(country, genre))
}

/** Warms the cache when a genre pill is hovered or focused, so the click usually feels instant. */
export function prefetchReleases(client: QueryClient, country: Country, genre: Genre) {
  // Errors are ignored here; the real query surfaces them if the genre is opened.
  client.query(releasesQuery(country, genre)).catch(() => {})
}
