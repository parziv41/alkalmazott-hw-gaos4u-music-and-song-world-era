// Vercel Function: Deezer's whole catalogue, for songs and artists the globe's own data doesn't have
// (most songs never topped a chart; many artists aren't among the best known of their country).
//
//   GET /api/search?q=gyöngyhajú   up to 5 artists and 8 tracks
//
// Self-contained on purpose: Vercel bundles each api/ file separately.

export type CatalogueSearch = {
  artists: { id: number; name: string; picture?: string; fans?: number }[]
  tracks: { id: number; title: string; artist: string; artistId: number; album?: string; cover?: string }[]
}

type DeezerArtist = { id: number; name: string; picture_medium?: string; nb_fan?: number }
type DeezerTrack = { id: number; title: string; artist: { id: number; name: string }; album?: { title?: string; cover_medium?: string } }

const USER_AGENT = 'GlobalMusicMapper/1.0'
const API = 'https://api.deezer.com'

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 100) ?? ''
  if (q.length < 2) return json(200, { artists: [], tracks: [] } satisfies CatalogueSearch)
  try {
    const [artists, tracks] = await Promise.all([
      deezer<{ data?: DeezerArtist[] }>(`/search/artist?q=${encodeURIComponent(q)}&limit=5`),
      deezer<{ data?: DeezerTrack[] }>(`/search/track?q=${encodeURIComponent(q)}&limit=8`),
    ])
    const result: CatalogueSearch = {
      artists: (artists?.data ?? []).map((artist) => ({ id: artist.id, name: artist.name, picture: artist.picture_medium, fans: artist.nb_fan })),
      tracks: (tracks?.data ?? []).map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist.name,
        artistId: track.artist.id,
        album: track.album?.title,
        cover: track.album?.cover_medium,
      })),
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
