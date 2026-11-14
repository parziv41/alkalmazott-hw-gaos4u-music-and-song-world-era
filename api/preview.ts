// Vercel Function: a playable 30-second preview from Deezer.
//
//   GET /api/preview?track=1823654007        a chart track matched by /api/charts
//   GET /api/preview?deezerArtist=2668       an artist's most popular track (id from Wikidata)
//   GET /api/preview?artist=Kispál%20és%20a%20Borz  the same, found by name when there is no id
//   GET /api/preview?artist=Ronny&title=Kleine%20Annabell  a particular song (the time machine's hits)
//       &details=1 also asks Deezer for the track's release date
//
// Deezer's preview links expire after about 15 minutes, so they are fetched when someone presses play
// rather than stored with the charts. Self-contained on purpose: Vercel bundles each api/ file separately.

export type Preview = { title: string; artist: string; preview: string; cover?: string; album?: string; link?: string; released?: string }

type DeezerTrack = {
  id: number
  title: string
  preview?: string
  link?: string
  artist: { name: string }
  album?: { title?: string; cover_medium?: string }
  release_date?: string
}
type DeezerArtist = { id: number; name: string; nb_fan?: number }

const USER_AGENT = 'GlobalMusicMapper/1.0'
const API = 'https://api.deezer.com'

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const trackId = params.get('track') ?? ''
  const artistId = params.get('deezerArtist') ?? ''
  const artist = params.get('artist')?.trim().slice(0, 120) ?? ''
  const title = params.get('title')?.trim().slice(0, 200) ?? ''
  const details = params.get('details') === '1'

  try {
    let track: DeezerTrack | null = null
    if (/^\d{1,15}$/.test(trackId)) track = await deezer<DeezerTrack>(`/track/${trackId}`)
    else if (artist && title) track = await songOf(artist, title)
    else if (/^\d{1,15}$/.test(artistId)) track = (await topTracks(Number(artistId))) ?? (artist ? await topTrackOf(artist) : null)
    else if (artist) track = await topTrackOf(artist)
    else return json(400, { error: 'bad_request', message: 'Expected track=<id>, deezerArtist=<id> or artist=<name>' })

    if (!track?.preview) return json(404, { error: 'not_found', message: 'No preview available.' })
    // Search results leave out the release date; the track itself (already fetched by id) has it.
    const released = track.release_date ?? (details ? ((await deezer<DeezerTrack>(`/track/${track.id}`).catch(() => null))?.release_date ?? undefined) : undefined)
    const preview: Preview = {
      title: track.title,
      artist: track.artist.name,
      preview: track.preview,
      cover: track.album?.cover_medium,
      album: track.album?.title,
      link: track.link,
      ...(released && released !== '0000-00-00' ? { released } : {}),
    }
    return json(200, preview, 'public, max-age=300, s-maxage=300')
  } catch {
    return json(502, { error: 'upstream_error', message: 'Deezer is unavailable.' })
  }
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

/** The first part of a double A-side, without "(feat. …)" or "(Remastered)". */
const mainTitle = (title: string) => title.split(' / ')[0].replace(/\s*[([].*?[)\]]/g, '').trim()
const leadArtist = (artist: string) => artist.split(/,|&|\/|\s+(?:feat\.?|ft\.?|featuring|and|with|y|és|und|et|vs\.?)\s+/i)[0].trim()

/** The search result that is this song: same title, by an artist with the same name. */
export function pickSong(candidates: DeezerTrack[], artist: string, title: string): DeezerTrack | null {
  const wantedTitle = normalize(mainTitle(title))
  const wantedArtist = normalize(leadArtist(artist))
  // Hungarian names come family name first on Wikipedia ("Kovács Kati"), given name first on Deezer.
  const words = (name: string) => name.split(/\s+/).map(normalize).filter(Boolean).sort().join(' ')
  const wantedWords = words(leadArtist(artist))
  const titleMatches = (track: DeezerTrack) => {
    const found = normalize(mainTitle(track.title))
    return found === wantedTitle || (found.startsWith(wantedTitle) && wantedTitle.length >= 4)
  }
  const artistMatches = (track: DeezerTrack) => {
    const found = normalize(track.artist.name)
    return found.includes(wantedArtist) || wantedArtist.includes(found) || words(track.artist.name) === wantedWords
  }
  const playable = candidates.filter((track) => track.preview && titleMatches(track))
  return playable.find(artistMatches) ?? null
}

/** A particular song: by artist and title first, then any search for both words. */
async function songOf(artist: string, title: string): Promise<DeezerTrack | null> {
  const queries = [`artist:"${leadArtist(artist)}" track:"${mainTitle(title)}"`, `${leadArtist(artist)} ${mainTitle(title)}`]
  for (const query of queries) {
    const found = await deezer<{ data?: DeezerTrack[] }>(`/search?q=${encodeURIComponent(query)}&limit=15`)
    const track = pickSong(found?.data ?? [], artist, title)
    if (track) return track
  }
  return null
}

/** The best-known Deezer artist with this exact name (several bands share names like "Omega"). */
async function topTrackOf(name: string): Promise<DeezerTrack | null> {
  const found = await deezer<{ data?: DeezerArtist[] }>(`/search/artist?q=${encodeURIComponent(name)}&limit=10`)
  const wanted = normalize(name)
  const artist = (found?.data ?? [])
    .filter((candidate) => normalize(candidate.name) === wanted)
    .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0]
  return artist ? topTracks(artist.id) : null
}

async function topTracks(artistId: number): Promise<DeezerTrack | null> {
  const top = await deezer<{ data?: DeezerTrack[] }>(`/artist/${artistId}/top?limit=5`)
  return top?.data?.find((track) => track.preview) ?? null
}

async function deezer<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Deezer ${response.status}`)
  const body = (await response.json()) as T & { error?: { code?: number } }
  if (body.error) {
    if (body.error.code === 800) return null // "no data"
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
