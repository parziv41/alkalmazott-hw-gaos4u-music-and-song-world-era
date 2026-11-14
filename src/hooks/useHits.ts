import { useQuery } from '@tanstack/react-query'
import type { Preview } from '../types/charts'
import type { AllTimeSong, CountryHits, HitsIndex, IndexedSong } from '../types/hits'
import { prepareHits } from '../utils/hitSearch'

async function load<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`)
  return (await response.json()) as T
}

/** Which years each country has number ones for (~10 KB). */
export function useHitsIndex(enabled: boolean) {
  return useQuery({
    queryKey: ['hits-index'],
    queryFn: ({ signal }) => load<HitsIndex>('/data/hits/index.json', signal),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** One country's number ones, year by year. */
export function useCountryHits(iso2: string, enabled: boolean) {
  return useQuery({
    queryKey: ['hits', iso2],
    queryFn: ({ signal }) => load<CountryHits>(`/data/hits/${iso2.toLowerCase()}.json`, signal),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** The all-time Top 30 (a few KB). */
export function useAllTime(enabled: boolean) {
  return useQuery({
    queryKey: ['hits-alltime'],
    queryFn: ({ signal }) => load<AllTimeSong[]>('/data/hits/alltime.json', signal),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Every song in the hits, ready to search (~300 KB gzipped): loaded when someone searches. */
export function useSongIndex(enabled: boolean) {
  return useQuery({
    queryKey: ['hits-songs'],
    queryFn: async ({ signal }) => prepareHits(await load<IndexedSong[]>('/data/hits/songs.json', signal)),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** A song's cover and release date from Deezer, for its card: by track id when known. Missing is not an error. */
export function useSongDetails(song: { title: string; artist: string; track?: number } | null) {
  return useQuery({
    queryKey: ['song-details', song?.track ?? `${song?.artist}|${song?.title}`],
    queryFn: async ({ signal }): Promise<Preview | null> => {
      const params = new URLSearchParams(song!.track ? { track: String(song!.track), details: '1' } : { artist: song!.artist, title: song!.title, details: '1' })
      const response = await fetch(`/api/preview?${params}`, { signal })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Preview ${response.status}`)
      return (await response.json()) as Preview
    },
    enabled: !!song,
    staleTime: 60 * 60_000,
    retry: 1,
  })
}

/** The decades a country has any number ones in. */
export const hitDecades = (years: number[]) => [...new Set(years.map((year) => Math.floor(year / 10) * 10))]

/** A Wikipedia link for "en:List of …". */
export function wikipediaUrl(page: string): string {
  const [lang, ...title] = page.split(':')
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.join(':').replaceAll(' ', '_'))}`
}
