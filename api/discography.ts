// Vercel Function: an artist's best-known tracks and releases on Deezer, for the artist card.
//
//   GET /api/discography?deezer=259             by Deezer id (from Wikidata)
//   GET /api/discography?name=Kov%C3%A1cs%20Kati  by name, when Wikidata has no id
//
// Self-contained on purpose: Vercel bundles each api/ file separately.

export type Discography = {
  name: string
  picture?: string
  fans?: number
  link?: string
  /** Deezer's most played tracks, best first. */
  top: { id: number; title: string; album?: string; cover?: string }[]
  /** Albums, EPs and singles (no compilations), oldest first; each title once, at its earliest date. */
  releases: { title: string; date: string; type: string; cover?: string }[]
}

type DeezerArtist = { id: number; name: string; picture_medium?: string; nb_fan?: number; link?: string }
type DeezerTrack = { id: number; title: string; album?: { title?: string; cover_medium?: string } }
type DeezerAlbum = { title: string; release_date?: string; record_type?: string; cover_medium?: string }

const USER_AGENT = 'GlobalMusicMapper/1.0'
const API = 'https://api.deezer.com'

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

/** Releases worth listing: no compilations, no unknown dates, a title once (a reissue keeps the original's date). */
export function tidyReleases(albums: DeezerAlbum[]): Discography['releases'] {
  const byTitle = new Map<string, Discography['releases'][number]>()
  for (const album of albums) {
    const date = album.release_date
    if (!date || date.startsWith('0000') || album.record_type === 'compile') continue
    const key = normalize(album.title.replace(/\s*[([].*?(remaster|deluxe|edition|version|anniversary|live).*?[)\]]/gi, ''))
    const known = byTitle.get(key)
    if (!known || date < known.date) byTitle.set(key, { title: album.title, date, type: album.record_type ?? 'album', cover: album.cover_medium })
  }
  return [...byTitle.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const id = params.get('deezer') ?? ''
  const name = params.get('name')?.trim().slice(0, 120) ?? ''
  try {
    let artist: DeezerArtist | null = null
    if (/^\d{1,15}$/.test(id)) artist = await deezer<DeezerArtist>(`/artist/${id}`)
    if (!artist && name) {
      const found = await deezer<{ data?: DeezerArtist[] }>(`/search/artist?q=${encodeURIComponent(name)}&limit=10`)
      const wanted = normalize(name)
      artist = (found?.data ?? []).filter((candidate) => normalize(candidate.name) === wanted).sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0] ?? null
    }
    if (!artist) return json(404, { error: 'not_found', message: 'No such artist on Deezer.' })
    const [top, albums] = await Promise.all([
      deezer<{ data?: DeezerTrack[] }>(`/artist/${artist.id}/top?limit=6`),
      deezer<{ data?: DeezerAlbum[] }>(`/artist/${artist.id}/albums?limit=200`),
    ])
    const result: Discography = {
      name: artist.name,
      picture: artist.picture_medium,
      fans: artist.nb_fan,
      link: artist.link,
      top: (top?.data ?? []).map((track) => ({ id: track.id, title: track.title, album: track.album?.title, cover: track.album?.cover_medium })),
      releases: tidyReleases(albums?.data ?? []),
    }
    return json(200, result, 'public, max-age=3600, s-maxage=86400')
  } catch {
    return json(502, { error: 'upstream_error', message: 'Deezer is unavailable.' })
  }
}

async function deezer<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Deezer ${response.status}`)
  const body = (await response.json()) as T & { error?: { code?: number } }
  if (body.error) {
    if (body.error.code === 800) return null
    throw new Error('Deezer error')
  }
  return body
}

function json(status: number, body: unknown, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  })
}
