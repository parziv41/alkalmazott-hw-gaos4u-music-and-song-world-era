// Vercel Function: the globe's musicians and bands, searched by name.
//
//   GET /api/artists?q=beatles   up to 10 matches: names that start with it first, then words that do
//                                (also all of the query's words, in any order: "Kovács Kati" finds
//                                "Kati Kovács"), then names that merely contain it; the best known first
//
// The index (api/_data/artists.json, written by scripts/build-artists.ts: 50,000 artists, a few MB) is too
// much to send to everyone who opens the search box, little enough to keep in a function's memory. Each
// artist matches by their name and by its other-language form (Kovács Kati / Kati Kovács).
import index from './_data/artists.json' with { type: 'json' }

export type ArtistMatch = {
  name: string
  /** The name in the other language, when it differs. */
  alias?: string
  iso2: string
  /** Birthplace or place of formation; empty when only the country is known. */
  cityId: string
  city: string
  /** Born (a person) or formed (a group); missing when unknown. */
  year?: number
  kind: 'p' | 'g'
  deezer?: number
  /** Wikidata item id. */
  id: string
  genres: string[]
}

type Row = [name: string, iso2: string, cityId: string, city: string, year: number, kind: 'p' | 'g', sitelinks: number, deezer: number, id: string, genres: string, alias: string]

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

type Name = { folded: string; words: string[]; wordStarts: number[] }
type Entry = { row: Row; names: Name[] }
let entries: Entry[] | null = null

/** A name folded ("thebeatles"), with where its words start, so "beat" and "stones" both match. */
function nameOf(text: string): Name {
  const words = text.split(/[\s\-–/&.,]+/).map(fold).filter(Boolean)
  const wordStarts: number[] = []
  let offset = 0
  for (const word of words) {
    wordStarts.push(offset)
    offset += word.length
  }
  return { folded: words.join(''), words, wordStarts }
}

function prepared(): Entry[] {
  entries ??= (index as Row[]).map((row) => ({ row, names: [nameOf(row[0]), ...(row[10] ? [nameOf(row[10])] : [])] }))
  return entries
}

function rankName({ folded, words, wordStarts }: Name, q: string, queryWords: string[]): number {
  if (folded.startsWith(q)) return 3
  if (wordStarts.some((start) => folded.startsWith(q, start))) return 2
  if (queryWords.length > 1 && queryWords.every((word) => words.some((name) => name.startsWith(word)))) return 2
  return folded.includes(q) ? 1 : 0
}

export function searchArtists(query: string, limit = 10): ArtistMatch[] {
  const q = fold(query)
  if (q.length < 2) return []
  const queryWords = query.split(/\s+/).map(fold).filter(Boolean)
  const scored: { row: Row; score: number }[] = []
  for (const { row, names } of prepared()) {
    const rank = Math.max(...names.map((name) => rankName(name, q, queryWords)))
    if (rank) scored.push({ row, score: rank * 10_000 + row[6] })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row: [name, iso2, cityId, city, year, kind, , deezer, id, genres, alias] }) => ({
      name,
      ...(alias ? { alias } : {}),
      iso2,
      cityId,
      city,
      ...(year ? { year } : {}),
      kind,
      ...(deezer ? { deezer } : {}),
      id,
      genres: genres ? genres.split(', ') : [],
    }))
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get('q')?.slice(0, 80) ?? ''
  return new Response(JSON.stringify({ artists: searchArtists(query) }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  })
}
