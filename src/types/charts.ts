// Response shapes of api/charts.ts and api/preview.ts.

export type ChartTrack = {
  rank: number
  title: string
  artist: string
  artwork?: string
  url?: string
  /** Deezer track id, for a 30-second preview. */
  deezerId?: number
  /** ISO code of the country the lead artist comes from (global chart only). */
  origin?: string
}

export type Chart = {
  source: 'apple' | 'shazam'
  scope: 'country' | 'city'
  period?: string
  updated?: string
  /** Tracks in the whole chart; `tracks` may be one page of them. */
  total: number
  tracks: ChartTrack[]
}

export type Preview = { title: string; artist: string; preview: string; cover?: string; album?: string; link?: string; released?: string }

/** Every national chart as [rank, song key] lists, keyed by country code (api/charts.ts?source=index). */
export type ChartIndex = { updated: string; complete: boolean; charts: Record<string, [number, string][]> }
