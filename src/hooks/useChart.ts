import { queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Chart, ChartIndex } from '../types/charts'
import type { Country } from '../types/music'
import type { City } from '../types/places'

export class ChartError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ChartError'
    this.status = status
    this.code = code
  }
}

/** Which chart to show: a Shazam city chart when the city has one, otherwise the national chart. */
export type ChartTarget = { scope: 'country' | 'city'; params: Record<string, string> }

export function chartTargetFor(country: Country, city?: City | null): ChartTarget | null {
  if (city?.chart && country.shazam) return { scope: 'city', params: { source: 'shazam', country: country.shazam, city: city.chart } }
  if (country.chart === 'apple') {
    const params: Record<string, string> = { source: 'apple', cc: country.iso2.toLowerCase() }
    if (country.shazam) params.fallback = country.shazam
    return { scope: 'country', params }
  }
  if (country.chart === 'shazam' && country.shazam) return { scope: 'country', params: { source: 'shazam', country: country.shazam } }
  return null
}

async function fetchChart(params: Record<string, string>, signal?: AbortSignal): Promise<Chart> {
  const response = await fetch(`/api/charts?${new URLSearchParams(params)}`, { signal })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new ChartError(response.status, body.error ?? 'http_error', body.message ?? `Chart request failed (${response.status})`)
  }
  return (await response.json()) as Chart
}

export const CHART_STALE_MS = 30 * 60 * 1000

/** One chart, for useQuery or for fetching ahead (the quiz picks songs this way). */
export function chartQuery(params: Record<string, string>) {
  return queryOptions({
    queryKey: ['chart', params],
    queryFn: ({ signal }) => fetchChart(params, signal),
    staleTime: CHART_STALE_MS,
    gcTime: 2 * CHART_STALE_MS,
    retry: (count, error) => count < 2 && !(error instanceof ChartError && error.status === 404),
  })
}

export function useChart(target: ChartTarget | null) {
  return useQuery({ ...chartQuery(target?.params ?? {}), enabled: !!target })
}

export const GLOBAL_TOP = 100
const GLOBAL_PAGE = 25

/**
 * Shazam's global chart, 25 songs at a time up to the top 100, each with the country its
 * artist comes from. Pages load one after another, which keeps the server within Deezer's rate limit.
 */
export function useGlobalChart(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['chart', 'global'],
    queryFn: ({ pageParam, signal }) =>
      fetchChart({ source: 'shazam', country: 'world', offset: String(pageParam), limit: String(GLOBAL_PAGE), origins: '1' }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.length * GLOBAL_PAGE
      return loaded < Math.min(GLOBAL_TOP, last.total) ? loaded : undefined
    },
    enabled,
    staleTime: CHART_STALE_MS,
    gcTime: 2 * CHART_STALE_MS,
  })
}

/**
 * Every national chart at once, for "where else is this song charting?". The server builds it at
 * most hourly (about 20 seconds the first time), so it loads only when someone asks.
 */
export const chartIndexQuery = () =>
  queryOptions({
    queryKey: ['chart', 'index'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/charts?source=index', { signal })
      if (!response.ok) throw new ChartError(response.status, 'http_error', `Chart index failed (${response.status})`)
      return (await response.json()) as ChartIndex
    },
    staleTime: CHART_STALE_MS,
    gcTime: 2 * CHART_STALE_MS,
  })

export function useChartIndex(enabled: boolean) {
  return useQuery({
    ...chartIndexQuery(),
    enabled,
    // A partial index (the server ran out of time) is fetched again soon to fill in.
    refetchInterval: (query) => (query.state.data && !query.state.data.complete ? 60_000 : false),
  })
}

/** Where a song is in the national charts: country code and rank, best ranks first. */
export function chartPositions(index: ChartIndex | undefined, key: string): { iso2: string; rank: number }[] {
  if (!index) return []
  const positions: { iso2: string; rank: number }[] = []
  for (const [iso2, list] of Object.entries(index.charts)) {
    const entry = list.find(([, songKey]) => songKey === key)
    if (entry) positions.push({ iso2, rank: entry[0] })
  }
  return positions.sort((a, b) => a.rank - b.rank || a.iso2.localeCompare(b.iso2))
}
