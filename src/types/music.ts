export type BBox = [west: number, south: number, east: number, north: number]

export type DiscogsQuery = {
  style?: string
  genre?: string
  q?: string
  /** Release-country override. `null` searches every country. */
  country?: string | null
  /** Never drop the country filter when broadening (for generic styles like "Folk" or "Rock"). */
  keepCountry?: boolean
  /** Search term for the keyword fallback; defaults to the genre name. */
  keyword?: string
}

export type Genre = {
  id: string
  name: string
  era: string
  blurb: string
  discogs: DiscogsQuery
}

/** The hand-written part of a country: its story and defining genres (src/data/countries.json). */
export type CuratedCountry = {
  /** ISO 3166-1 numeric code, which is also the world-atlas feature id. */
  id: string
  iso2: string
  name: string
  region: string
  /** OKLCH hue (0–360) of the country's accent colour. */
  hue: number
  /** Area the camera frames on selection: the mainland, not overseas territories. */
  bbox: BBox
  /** Too small to click at world scale, so it is also drawn as a marker. */
  small?: boolean
  description: string
  /** Discogs' own release-country string, e.g. "US", "UK", "Brazil". */
  discogsCountry: string
  genres: Genre[]
}

/** Every country and territory on the globe (src/data/world.json), merged with its curated data if any. */
export type Country = {
  id: string
  iso2: string
  name: string
  region: string
  hue: number
  bbox: BBox
  /** Where the camera looks when the country opens. */
  center: [lon: number, lat: number]
  small?: boolean
  /** Which service publishes the national chart. */
  chart?: 'apple' | 'shazam'
  /** Shazam's slug for the country, used for its country and city charts. */
  shazam?: string
  cityCount: number
  artistCount: number
  filmCount: number
  /** Curated countries only. */
  description?: string
  discogsCountry?: string
  /** Curated genres; empty for countries without a hand-written entry. */
  genres: Genre[]
}

export type Release = {
  id: number
  artist: string
  title: string
  year?: number
  coverUrl?: string
  label?: string
  format?: string
  discogsUrl: string
  popularity: number
}

/** How the results were found: country + style, style worldwide, keyword search, or nothing. */
export type MatchQuality = 'exact' | 'global' | 'keyword' | 'none'

export type ReleaseResult = { releases: Release[]; match: MatchQuality }
