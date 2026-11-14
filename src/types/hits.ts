import type { ArtistMatch } from './artists.ts'

// The time machine's hits (public/data/hits, built by scripts/build-hits.ts).

/** Title, artist, weeks at number one that year (0 for festival songs), and a festival prize. */
export type HitSong = [title: string, artist: string, weeks: number, note?: string]

/** One country's year: its number ones from a Wikipedia list, or (Hungary 1966–72) the Táncdalfesztivál. */
export type HitYear = { page: string; kind: 'chart' | 'festival'; songs: HitSong[] }

/** `public/data/hits/<iso2>.json`, by year. */
export type CountryHits = Record<string, HitYear>

/** `public/data/hits/index.json`: the years each country has, by ISO code. */
export type HitsIndex = Record<string, number[]>

/** Where and when a song was a number one: country, year, weeks at number one that year (0 for festival songs). */
export type SongEntry = [iso2: string, year: number, weeks: number]

/** One of the all-time Top 30 (`public/data/hits/alltime.json`, built by scripts/build-hits.ts). */
export type AllTimeSong = {
  title: string
  artist: string
  entries: SongEntry[]
  first: number
  /** Countries where it was number one, and how many had a chart in its busiest year. */
  countries: number
  coverage: number
  weeks: number
  origin?: ArtistMatch
}

/** `public/data/hits/songs.json`: every song in the hits, most widespread first. */
export type IndexedSong = [title: string, artist: string, entries: SongEntry[]]
