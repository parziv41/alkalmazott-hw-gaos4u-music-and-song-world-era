// Vercel Function: what a country or city is listening to right now.
//
//   GET /api/charts?source=apple&cc=hu[&fallback=hungary]  Apple Music's most-played songs in a country
//                                                          (Shazam's country chart if Apple fails)
//   GET /api/charts?source=shazam&country=france&city=paris Shazam's top 50 for a city (or a country without `city`)
//   GET /api/charts?source=shazam&country=world&offset=25&limit=25&origins=1
//                                                          a page of Shazam's global top 200, with each artist's country
//   GET /api/charts?source=index                           every country's national chart as song keys and ranks,
//                                                          for "where else is this song charting?" (built hourly)
//
// Shazam's chart export has no artwork, so tracks are matched on Deezer for covers and a preview id.
// With `origins`, each lead artist's Deezer id is looked up on Wikidata for the country they come from.
// Self-contained on purpose: Vercel bundles each file in api/ as its own function (the country list is
// read from the app's own data file).
import world from '../src/data/world.json' with { type: 'json' }

export type ChartTrack = {
  rank: number
  title: string
  artist: string
  artwork?: string
  url?: string
  /** Deezer track id, for fetching a fresh 30-second preview through /api/preview. */
  deezerId?: number
  /** ISO code of the country the lead artist comes from (only with `origins`). */
  origin?: string
}

export type ChartResponse = {
  source: 'apple' | 'shazam'
  scope: 'country' | 'city'
  /** What the chart measures, as its publisher words it, e.g. "past 7 days". */
  period?: string
  updated?: string
  /** All tracks in the chart; `tracks` is the requested page of them. */
  total: number
  tracks: ChartTrack[]
}

type RawChart = Omit<ChartResponse, 'total'>

const USER_AGENT = 'GlobalMusicMapper/1.0'
const APPLE_TRACKS = 25
const PAGE = 25
const MAX_PAGE = 50
const SLUG = /^[\p{Ll}\p{N}%.-]{1,60}$/u
const CHART_TTL_MS = 30 * 60 * 1000
const APPLE_TIMEOUT_MS = 6000
const MATCH_TTL_MS = 12 * 60 * 60 * 1000

class UpstreamError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Warm function instances (and the dev server) reuse these between requests.
const chartCache = new Map<string, { expires: number; value: RawChart }>()
const matchCache = new Map<string, { expires: number; value: DeezerMatch | null }>()
const originCache = new Map<number, { expires: number; value: string | null }>()

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const source = params.get('source')
  if (source === 'index') {
    try {
      const index = await chartIndex()
      return json(200, index, index.complete ? 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=60, s-maxage=120')
    } catch (error) {
      return json(502, { error: 'upstream_error', message: error instanceof Error ? error.message : 'Charts unavailable.' })
    }
  }
  const cc = params.get('cc')?.toLowerCase() ?? ''
  const country = params.get('country')?.toLowerCase() ?? ''
  const city = params.get('city')?.toLowerCase() ?? ''

  const offset = Math.max(0, Number.parseInt(params.get('offset') ?? '0', 10) || 0)
  const limit = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(params.get('limit') ?? String(PAGE), 10) || PAGE))
  const withOrigins = params.get('origins') === '1'

  let key: string
  let load: () => Promise<RawChart>
  const fallback = params.get('fallback')?.toLowerCase() ?? ''
  if (source === 'apple' && /^[a-z]{2}$/.test(cc) && (!fallback || SLUG.test(fallback))) {
    key = `apple:${cc}`
    // Apple's feed sometimes stalls for half a minute; Shazam's chart is a good stand-in.
    load = () => appleChart(cc).catch((error: unknown) => (fallback ? shazamChart(fallback) : Promise.reject(error)))
  } else if (source === 'shazam' && SLUG.test(country) && (!city || SLUG.test(city))) {
    key = `shazam:${country}:${city}`
    load = () => shazamChart(country, city || undefined)
  } else {
    return json(400, { error: 'bad_request', message: 'Expected source=apple&cc=xx or source=shazam&country=…[&city=…]' })
  }

  try {
    const hit = chartCache.get(key)
    const chart = hit && hit.expires > Date.now() ? hit.value : await load()
    if (!hit || hit.value !== chart) chartCache.set(key, { expires: Date.now() + CHART_TTL_MS, value: chart })
    // Only the requested page is matched on Deezer, which keeps within its rate limit.
    const page = await withDeezer(chart.tracks.slice(offset, offset + limit))
    const tracks = withOrigins ? await withOriginsOf(page) : page
    const body: ChartResponse = { ...chart, total: chart.tracks.length, tracks: tracks.map(publicTrack) }
    return json(200, body, 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400')
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return json(404, { error: 'no_chart', message: 'No chart is published here.' })
    return json(502, { error: 'upstream_error', message: error instanceof Error ? error.message : 'Chart source unavailable.' })
  }
}

// ── Apple Music ──────────────────────────────────────────────────────────────

type AppleFeed = {
  feed: {
    updated?: string
    results?: { name: string; artistName: string; artworkUrl100?: string; url?: string }[]
  }
}

/** `quick`: one short try, for building the all-countries index within its time budget. */
async function appleChart(cc: string, { quick = false } = {}): Promise<RawChart> {
  const url = `https://rss.marketingtools.apple.com/api/v2/${cc}/music/most-played/${APPLE_TRACKS}/songs.json`
  const timeout = quick ? 4000 : APPLE_TIMEOUT_MS
  const request = () => fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(timeout) })
  let response = await request()
  // The feed's edge regularly answers 502 for a moment; a short retry is usually enough.
  for (let attempt = 1; !quick && attempt <= 2 && (response.status === 502 || response.status === 503); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
    response = await request()
  }
  // Apple answers storefronts that don't exist with a 500 (or a 404).
  if (response.status === 404 || response.status === 500) throw new UpstreamError(404, 'No Apple Music storefront')
  if (!response.ok) throw new UpstreamError(response.status, `Apple Music ${response.status}`)
  const { feed } = (await response.json()) as AppleFeed
  const tracks: ChartTrack[] = (feed.results ?? []).map((result, index) => ({
    rank: index + 1,
    title: result.name,
    artist: result.artistName,
    artwork: result.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/200x200bb.'),
    url: result.url,
  }))
  if (!tracks.length) throw new UpstreamError(404, 'Empty chart')
  return { source: 'apple', scope: 'country', period: 'most played today', updated: toIso(feed.updated), tracks }
}

// ── Shazam ───────────────────────────────────────────────────────────────────

async function shazamChart(country: string, city?: string): Promise<RawChart> {
  const path = city ? `top-50/${country}/${city}` : `top-200/${country}`
  const response = await fetch(`https://www.shazam.com/services/charts/csv/${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv' },
  })
  if (response.status === 404) throw new UpstreamError(404, 'No Shazam chart')
  if (!response.ok) throw new UpstreamError(response.status, `Shazam ${response.status}`)
  const lines = (await response.text()).replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())

  // First line: "Wednesday, 11 November 2026 [performance over the past 7 days]", then a header row.
  const heading = parseCsvLine(lines[0] ?? '')[0] ?? ''
  const period = heading.match(/\[(?:performance over )?(.+?)\]/)?.[1]
  const date = Date.parse(heading.replace(/\s*\[.*\]/, ''))
  const tracks: ChartTrack[] = []
  for (const line of lines.slice(1)) {
    const [rank, artist, title] = parseCsvLine(line)
    const position = Number(rank)
    if (!Number.isInteger(position) || !artist || !title) continue
    tracks.push({ rank: position, title, artist })
  }
  if (!tracks.length) throw new UpstreamError(404, 'Empty chart')
  return {
    source: 'shazam',
    scope: city ? 'city' : 'country',
    period,
    updated: Number.isFinite(date) ? new Date(date).toISOString() : undefined,
    tracks,
  }
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      cells.push(cell)
      cell = ''
    } else cell += char
  }
  cells.push(cell)
  return cells.map((value) => value.trim())
}

// ── Deezer matching ──────────────────────────────────────────────────────────

type DeezerMatch = { id: number; artistId?: number; cover?: string; link?: string }
type DeezerTrack = {
  id: number
  title: string
  title_short?: string
  link?: string
  artist: { id?: number; name: string }
  album?: { cover_medium?: string }
}
type MatchedTrack = ChartTrack & { deezerArtist?: number }

export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

/** "KAROL G, Judeline & rusowsky" → "KAROL G" */
export const leadArtist = (artist: string) => artist.split(/,|&|\s+(?:feat\.?|ft\.?|x|and|with)\s+/i)[0].trim()

export function isSameTrack(candidate: DeezerTrack, artist: string, title: string): boolean {
  const wantedArtist = normalize(leadArtist(artist))
  const gotArtist = normalize(candidate.artist.name)
  if (!wantedArtist || !gotArtist || !(gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist))) return false
  const wantedTitle = normalize(title.replace(/\s*[([].*?[)\]]/g, ''))
  const gotTitle = normalize(candidate.title_short ?? candidate.title)
  const prefix = Math.min(6, wantedTitle.length, gotTitle.length)
  return prefix > 0 && wantedTitle.slice(0, prefix) === gotTitle.slice(0, prefix)
}

async function findOnDeezer(artist: string, title: string): Promise<DeezerMatch | null> {
  const key = `${artist}|${title}`
  const hit = matchCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  try {
    const url = new URL('https://api.deezer.com/search')
    url.searchParams.set('q', `${leadArtist(artist)} ${title.replace(/\s*\((?:feat|with)[^)]*\)/i, '')}`)
    url.searchParams.set('limit', '5')
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    const body = (await response.json()) as { data?: DeezerTrack[]; error?: unknown }
    if (body.error) return null // quota or upstream error: don't cache, try again next time
    const track = body.data?.find((candidate) => isSameTrack(candidate, artist, title))
    const value = track ? { id: track.id, artistId: track.artist.id, cover: track.album?.cover_medium, link: track.link } : null
    matchCache.set(key, { expires: Date.now() + MATCH_TTL_MS, value })
    return value
  } catch {
    return null
  }
}

/** Adds Deezer ids (and covers where the chart has none), five lookups at a time to respect Deezer's rate limit. */
async function withDeezer(tracks: ChartTrack[]): Promise<MatchedTrack[]> {
  const result: MatchedTrack[] = [...tracks]
  let next = 0
  const worker = async () => {
    while (next < result.length) {
      const index = next++
      const track = result[index]
      const match = await findOnDeezer(track.artist, track.title)
      if (match) {
        result[index] = { ...track, deezerId: match.id, deezerArtist: match.artistId, artwork: track.artwork ?? match.cover, url: track.url ?? match.link }
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker))
  return result
}

/** Drops the internal Deezer artist id from a track. */
function publicTrack(track: MatchedTrack): ChartTrack {
  const copy = { ...track }
  delete copy.deezerArtist
  return copy
}

// ── Where artists come from ──────────────────────────────────────────────────

/**
 * The country each artist comes from, through Wikidata's Deezer artist ids (P2722): a band's
 * country of origin or place of formation, else a person's birthplace, else their citizenship.
 */
async function withOriginsOf(tracks: MatchedTrack[]): Promise<MatchedTrack[]> {
  const now = Date.now()
  const wanted = [...new Set(tracks.flatMap((track) => (track.deezerArtist ? [track.deezerArtist] : [])))].filter(
    (id) => (originCache.get(id)?.expires ?? 0) <= now,
  )
  if (wanted.length) {
    const found = await lookUpOrigins(wanted).catch(() => null)
    // Don't remember failures: the next request tries again.
    if (found) for (const id of wanted) originCache.set(id, { expires: now + MATCH_TTL_MS, value: found.get(id) ?? null })
  }
  return tracks.map((track) => {
    const origin = track.deezerArtist ? originCache.get(track.deezerArtist)?.value : null
    return origin ? { ...track, origin } : track
  })
}

const ORIGIN_PRIORITY = ['origin', 'formed', 'born', 'citizen'] as const

async function lookUpOrigins(deezerIds: number[]): Promise<Map<number, string>> {
  const query = `
SELECT ?deezer ?origin ?formed ?born ?citizen WHERE {
  VALUES ?deezer { ${deezerIds.map((id) => `"${id}"`).join(' ')} }
  ?artist <http://www.wikidata.org/prop/direct/P2722> ?deezer .
  OPTIONAL { ?artist <http://www.wikidata.org/prop/direct/P495>/<http://www.wikidata.org/prop/direct/P297> ?origin }
  OPTIONAL { ?artist <http://www.wikidata.org/prop/direct/P740>/<http://www.wikidata.org/prop/direct/P17>/<http://www.wikidata.org/prop/direct/P297> ?formed }
  OPTIONAL { ?artist <http://www.wikidata.org/prop/direct/P19>/<http://www.wikidata.org/prop/direct/P17>/<http://www.wikidata.org/prop/direct/P297> ?born }
  OPTIONAL { ?artist <http://www.wikidata.org/prop/direct/P27>/<http://www.wikidata.org/prop/direct/P297> ?citizen }
}`
  type Row = Partial<Record<'deezer' | (typeof ORIGIN_PRIORITY)[number], { value: string }>>
  let rows: Row[] | null = null
  // The official endpoint first; QLever (same data) if it is slow or down.
  for (const endpoint of ['https://query.wikidata.org/sparql', 'https://qlever.dev/api/wikidata']) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
        body: new URLSearchParams({ query }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) continue
      rows = ((await response.json()) as { results: { bindings: Row[] } }).results.bindings
      break
    } catch {
      // try the next endpoint
    }
  }
  if (!rows) throw new Error('Wikidata unavailable')

  const best = new Map<number, { rank: number; iso: string }>()
  for (const row of rows) {
    const id = Number(row.deezer?.value)
    ORIGIN_PRIORITY.forEach((field, rank) => {
      const iso = row[field]?.value
      if (!iso) return
      const current = best.get(id)
      if (!current || rank < current.rank) best.set(id, { rank, iso: iso.toUpperCase() })
    })
  }
  return new Map([...best].map(([id, { iso }]) => [id, iso]))
}

// ── Every national chart at once ─────────────────────────────────────────────

/** Country code → [rank, song key] for each song in its national chart. `complete` is false when the
 * time budget ran out first; such an index is cached only briefly, so the next request fills it in. */
export type ChartIndex = { updated: string; complete: boolean; charts: Record<string, [number, string][]> }

type WorldEntry = { iso2: string; chart?: 'apple' | 'shazam'; shazam?: string }
const INDEX_TTL_MS = 60 * 60 * 1000
const PARTIAL_TTL_MS = 5 * 60 * 1000
const INDEX_CONCURRENCY = 16
/** Well inside the function's 60 s limit (vercel.json). */
const INDEX_BUDGET_MS = 40_000
let indexCache: { expires: number; value: Promise<ChartIndex> } | null = null

/** The same song on Apple's and Shazam's charts: lead artist and title, without "(feat. …)" and punctuation. */
export const songKey = (artist: string, title: string) => `${normalize(leadArtist(artist))}|${normalize(title.replace(/\s*[([].*?[)\]]/g, ''))}`

/**
 * Fetches every country's national chart (about 170, eight at a time) and keeps just the song keys
 * and ranks. Built at most once an hour per instance; the edge caches the result too.
 */
function chartIndex(): Promise<ChartIndex> {
  if (indexCache && indexCache.expires > Date.now()) return indexCache.value
  // A partial index is a head start: the next build only fetches what's missing.
  const previous = indexCache?.value
  const value = (previous ?? Promise.resolve(null)).catch(() => null).then((earlier) => buildIndex(earlier?.charts ?? {}))
  indexCache = { expires: Date.now() + INDEX_TTL_MS, value }
  value.then(
    (index) => {
      if (!index.complete && indexCache?.value === value) indexCache.expires = Date.now() + PARTIAL_TTL_MS
    },
    () => {
      indexCache = null
    },
  )
  return value
}

async function buildIndex(known: ChartIndex['charts']): Promise<ChartIndex> {
  const deadline = Date.now() + INDEX_BUDGET_MS
  const countries = (world as WorldEntry[]).filter((country) => country.chart && !known[country.iso2])
  const charts: ChartIndex['charts'] = { ...known }
  let next = 0
  const worker = async () => {
    while (next < countries.length && Date.now() < deadline) {
      const { iso2, chart, shazam } = countries[next++]
      const load = () => (chart === 'apple' ? appleChart(iso2.toLowerCase(), { quick: true }) : shazamChart(shazam!))
      const raw = await load().catch(() => (chart === 'apple' && shazam ? shazamChart(shazam).catch(() => null) : null))
      if (raw) charts[iso2] = raw.tracks.slice(0, 50).map((track) => [track.rank, songKey(track.artist, track.title)])
    }
  }
  await Promise.all(Array.from({ length: INDEX_CONCURRENCY }, worker))
  if (!Object.keys(charts).length) throw new Error('No chart could be loaded')
  // Counts as complete when every country was tried and few failed; otherwise the next build retries the rest.
  const wanted = (world as WorldEntry[]).filter((country) => country.chart).length
  const complete = next >= countries.length && Object.keys(charts).length >= wanted * 0.85
  return { updated: new Date().toISOString(), complete, charts }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIso(value?: string): string | undefined {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined
}

function json(status: number, body: unknown, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  })
}
