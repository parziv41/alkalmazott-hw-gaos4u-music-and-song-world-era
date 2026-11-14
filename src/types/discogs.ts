/** The subset of a Discogs `/database/search` result that the app reads. */
export type DiscogsSearchResult = {
  id: number
  type: 'release' | 'master' | 'artist' | 'label'
  master_id?: number | null
  title: string
  year?: string
  country?: string
  cover_image?: string
  thumb?: string
  uri?: string
  label?: string[]
  format?: string[]
  genre?: string[]
  style?: string[]
  community?: { want?: number; have?: number }
}

export type DiscogsSearchResponse = {
  pagination?: { items: number; page: number; pages: number; per_page: number }
  results: DiscogsSearchResult[]
}

export type DiscogsErrorBody = { error?: string; message?: string }
