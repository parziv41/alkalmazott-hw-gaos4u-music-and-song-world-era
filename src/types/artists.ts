// Mirrors api/artists.ts and api/discography.ts (the app and the functions are separate TypeScript projects).

/** A musician or band from the globe's places: where and when they were born or formed. */
export type ArtistMatch = {
  name: string
  /** The name in the other language, when it differs (Kovács Kati / Kati Kovács). */
  alias?: string
  iso2: string
  /** Birthplace or place of formation; empty when only the country is known. */
  cityId: string
  city: string
  year?: number
  kind: 'p' | 'g'
  deezer?: number
  /** Wikidata item id. */
  id: string
  genres: string[]
}

/** Deezer's catalogue searched by name (mirrors api/search.ts). */
export type CatalogueSearch = {
  artists: { id: number; name: string; picture?: string; fans?: number }[]
  tracks: { id: number; title: string; artist: string; artistId: number; album?: string; cover?: string }[]
}

/** An artist's best-known tracks and releases on Deezer. */
export type Discography = {
  name: string
  picture?: string
  fans?: number
  link?: string
  top: { id: number; title: string; album?: string; cover?: string }[]
  /** Albums, EPs and singles, oldest first. */
  releases: { title: string; date: string; type: string; cover?: string }[]
}
