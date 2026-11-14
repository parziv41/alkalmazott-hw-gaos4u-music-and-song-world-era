// Searching the time machine's hits by song or artist. The build (scripts/build-hits.ts) uses the same
// key to bring one song's entries from different countries together.
import type { IndexedSong, SongEntry } from '../types/hits.ts'

/** Lowercase letters and digits only: "Nem leszek a játékszered!" → "nemleszekajatekszered". */
export const foldText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

/** The first name in a credit: "Mark Ronson featuring Bruno Mars" → "Mark Ronson". */
export const leadArtist = (artist: string) => artist.split(/,|&|\/|\s+(?:feat\.?|ft\.?|featuring|and|with|x|vs\.?|y|und|et|és)\s+/i)[0].trim()

/**
 * The same song however each country's list writes it: "(I Can't Get No) Satisfaction" and
 * "Satisfaction", "The Beatles" and "Beatles", a double A-side either way round.
 */
export function anySongKey(title: string, artist: string): string {
  const plainTitle = title
    .split(' / ')
    .map((part) => foldText(part.replace(/\s*[([].*?[)\]]\s*/g, ' ')) || foldText(part))
    .sort()
    .join('/')
  const lead = leadArtist(artist).replace(/^the\s+/i, '')
  return `${plainTitle}|${foldText(lead) || foldText(artist)}`
}

/**
 * A name's words, folded and sorted: "Kovács Kati" (Hungarian order, as the Táncdalfesztivál lists
 * have it) and "Kati Kovács" (Wikidata's English label) are the same artist. A leading "The" doesn't count.
 */
export const nameKey = (name: string) =>
  name
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/^the\s+/i, '')
    .split(/[\s\-–/&.,]+/)
    .map(foldText)
    .filter(Boolean)
    .sort()
    .join(' ')

export type SongHit = { title: string; artist: string; entries: SongEntry[]; first: number; countries: number }
export type ArtistHit = { name: string; songs: SongHit[]; countries: number; first: number; last: number }
export type PreparedHits = {
  songs: { song: SongHit; title: string; artist: string }[]
  artists: Map<string, ArtistHit>
  /** The same artists by nameKey, to find a searched musician's number ones. */
  byName: Map<string, ArtistHit>
  /** Songs by anySongKey, to tell whether a song found elsewhere (Deezer) was a number one. */
  byKey: Map<string, SongHit>
}

const toSong = ([title, artist, entries]: IndexedSong): SongHit => ({
  title,
  artist,
  entries,
  first: Math.min(...entries.map(([, year]) => year)),
  countries: new Set(entries.map(([iso2]) => iso2)).size,
})

/** Folded names for matching, and artists with all their songs (by lead artist), once per load. */
export function prepareHits(index: IndexedSong[]): PreparedHits {
  const songs = index.map((entry) => {
    const song = toSong(entry)
    return { song, title: foldText(song.title), artist: foldText(song.artist) }
  })
  const artists = new Map<string, ArtistHit & { names: Map<string, number> }>()
  for (const { song } of songs) {
    const lead = leadArtist(song.artist)
    const key = foldText(lead.replace(/^the\s+/i, ''))
    if (!key) continue
    const artist = artists.get(key) ?? { name: lead, names: new Map<string, number>(), songs: [], countries: 0, first: Infinity, last: -Infinity }
    artist.songs.push(song)
    artist.names.set(lead, (artist.names.get(lead) ?? 0) + song.entries.length)
    artists.set(key, artist)
  }
  for (const artist of artists.values()) {
    artist.name = [...artist.names].sort((a, b) => b[1] - a[1])[0][0]
    const entries = artist.songs.flatMap((song) => song.entries)
    artist.countries = new Set(entries.map(([iso2]) => iso2)).size
    artist.first = Math.min(...entries.map(([, year]) => year))
    artist.last = Math.max(...entries.map(([, year]) => year))
    artist.songs.sort((a, b) => a.first - b.first || b.countries - a.countries)
  }
  const byName = new Map<string, ArtistHit>()
  for (const artist of artists.values()) {
    const key = nameKey(artist.name)
    const known = byName.get(key)
    if (!known || artist.songs.length > known.songs.length) byName.set(key, artist)
  }
  const byKey = new Map(songs.map(({ song }) => [anySongKey(song.title, song.artist), song]))
  return { songs, artists, byName, byKey }
}

/** Songs whose title (or artist) matches, and artists whose name matches: starts of words first, then the most widespread. */
export function searchHits(prepared: PreparedHits, query: string, limits = { songs: 8, artists: 5 }): { songs: SongHit[]; artists: ArtistHit[] } {
  const q = foldText(query)
  if (q.length < 2) return { songs: [], artists: [] }
  const songs = prepared.songs
    .map(({ song, title, artist }) => {
      const score = title.startsWith(q) ? 4 : title.includes(q) ? 3 : artist.startsWith(q) ? 2 : artist.includes(q) ? 1 : 0
      return { song, score: score * 1e6 + song.countries * 1000 + Math.min(song.entries.length, 999) }
    })
    .filter(({ score }) => score >= 1e6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.songs)
    .map(({ song }) => song)
  const artists = [...prepared.artists]
    .map(([key, artist]) => ({ artist, score: (key.startsWith(q) ? 2 : key.includes(q) ? 1 : 0) * 1e6 + artist.songs.length * 100 + artist.countries }))
    .filter(({ score }) => score >= 1e6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.artists)
    .map(({ artist }) => artist)
  return { songs, artists }
}
