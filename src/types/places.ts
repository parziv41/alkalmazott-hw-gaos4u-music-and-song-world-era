// Shapes of the files that scripts/build-world-data.ts writes to public/data/.

export type Artist = {
  /** Wikidata item id. */
  id: string
  name: string
  /** A person (place of birth) or a group (place of formation). */
  kind: 'p' | 'g'
  /** Born or formed. */
  year?: number
  genres?: string[]
  /** Wikimedia Commons file name. */
  image?: string
  /** Deezer artist id, when Wikidata has one. */
  deezer?: number
  /** Number of Wikipedia editions with an article: a rough measure of fame. */
  sl: number
}

export type Film = {
  id: string
  name: string
  year?: number
  director?: string
  /** Poster thumbnail URL: the lead image of the film's English Wikipedia article. */
  poster?: string
  /** IMDb title id (tt…). */
  imdb?: string
  sl: number
}

export type City = {
  /** Wikidata item id of the place (or `gn<GeoNames id>` for a chart-only city). */
  id: string
  name: string
  lat: number
  lon: number
  /** Shazam's slug for this city's chart, when it has one. */
  chart?: string
  artists: Artist[]
  films: Film[]
}

export type CountryPlaces = { iso2: string; cities: City[] }

export type SearchCity = {
  id: string
  name: string
  iso2: string
  lat: number
  lon: number
  artists: number
  films: number
  /** Shazam's slug for the city's chart. */
  chart?: string
}

/** A town or village from public/data/gazetteer.json (scripts/build-gazetteer.ts). */
export type Settlement = {
  /** Wikidata id (Hungary) or `g<GeoNames id>`. */
  id: string
  name: string
  iso2: string
  lat: number
  lon: number
  population: number
  /** County or first-level region. */
  region: string
}

/** public/data/timeline.json: counts per decade (index into `decades`; 1840 stands for "before 1850"). */
export type Timeline = {
  decades: number[]
  /** Per country (upper-case ISO code): artists born or formed (`a`) and films made (`f`) per decade. */
  countries: Record<string, { a: number[]; f: number[] }>
  /** Each decade's centre of gravity, [lon, lat, how many], or null for an empty decade. */
  centers: { a: ([number, number, number] | null)[]; f: ([number, number, number] | null)[] }
}
