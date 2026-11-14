import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { nameKey } from '../utils/hitSearch'
import type { ArtistMatch, CatalogueSearch, Discography } from '../types/artists'

/** The value, once it has stopped changing for `ms`: a request per pause in typing, not per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return settled
}

/** Musicians and bands whose name matches, searched on the server (the index is 2.8 MB). */
export function useArtistSearch(query: string, enabled: boolean) {
  const q = useDebounced(query.trim(), 150)
  return useQuery({
    queryKey: ['artist-search', q],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/artists?${new URLSearchParams({ q })}`, { signal })
      if (!response.ok) throw new Error(`Artist search ${response.status}`)
      return ((await response.json()) as { artists: ArtistMatch[] }).artists
    },
    enabled: enabled && q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60_000,
  })
}

/** Songs and artists from Deezer's whole catalogue (any song, not just number ones). */
export function useCatalogueSearch(query: string, enabled: boolean) {
  const q = useDebounced(query.trim(), 200)
  return useQuery({
    queryKey: ['catalogue-search', q],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/search?${new URLSearchParams({ q })}`, { signal })
      if (!response.ok) throw new Error(`Search ${response.status}`)
      return (await response.json()) as CatalogueSearch
    },
    enabled: enabled && q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60_000,
  })
}

/** Where an artist comes from, by name: the best match in the artist index whose name (or alias) is this one. */
export function useArtistOrigin(name: string | null) {
  const search = useArtistSearch(name ?? '', !!name)
  const wanted = name ? nameKey(name) : ''
  return search.data?.find((artist) => nameKey(artist.name) === wanted || (!!artist.alias && nameKey(artist.alias) === wanted))
}

/** An artist's top tracks and releases from Deezer, by id when known, else by name. Not on Deezer: null. */
export function useDiscography(artist: { name: string; deezer?: number } | null) {
  return useQuery({
    queryKey: ['discography', artist?.deezer ?? artist?.name],
    queryFn: async ({ signal }): Promise<Discography | null> => {
      const params = new URLSearchParams(artist!.deezer ? { deezer: String(artist!.deezer), name: artist!.name } : { name: artist!.name })
      const response = await fetch(`/api/discography?${params}`, { signal })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Discography ${response.status}`)
      return (await response.json()) as Discography
    },
    enabled: !!artist,
    staleTime: 60 * 60_000,
    retry: 1,
  })
}
