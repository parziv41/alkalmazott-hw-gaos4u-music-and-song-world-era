// Discogs search pipeline: build queries with fallbacks, pick the most-collected
// records, and normalize them into the app's Release shape.
// Only type imports (with .ts extensions) so scripts/verify-data.ts can run this file in plain Node.
import type { DiscogsErrorBody, DiscogsSearchResponse, DiscogsSearchResult } from '../types/discogs.ts'
import type { Country, Genre, MatchQuality, Release, ReleaseResult } from '../types/music.ts'

/** All the Discogs search needs to know about a country. */
type DiscogsCountry = Pick<Country, 'discogsCountry'>

export type SearchFetcher = (params: URLSearchParams, signal?: AbortSignal) => Promise<DiscogsSearchResponse>

export class DiscogsError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'DiscogsError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export const RESULTS_WANTED = 3
const PER_PAGE = 100
// Compilations often top the "most collected" charts; prefer artist albums unless a compilation dominates.
const COMPILATION_WEIGHT = 0.35
const FORMAT_PRIORITY = ['Compilation', 'LP', 'EP', 'Single', 'Album', 'CD', 'Cassette', 'Vinyl']

export const browserFetcher: SearchFetcher = async (params, signal) => {
  const response = await fetch(`/api/discogs/search?${params}`, { signal })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as DiscogsErrorBody
    throw new DiscogsError(
      response.status,
      body.error ?? 'http_error',
      body.message ?? `Discogs request failed (${response.status})`,
      Number(response.headers.get('Retry-After')) || undefined,
    )
  }
  return (await response.json()) as DiscogsSearchResponse
}

export function releaseCountryFor(country: DiscogsCountry, genre: Genre): string | null {
  return genre.discogs.country === undefined ? (country.discogsCountry ?? null) : genre.discogs.country
}

type Attempt = { match: Exclude<MatchQuality, 'none'>; params: Record<string, string> }

/** Searches to try in order: exact, then the style worldwide, then a keyword search. */
export function buildAttempts(country: DiscogsCountry, genre: Genre): Attempt[] {
  const { style, genre: discogsGenre, q, keepCountry, keyword } = genre.discogs
  const releaseCountry = releaseCountryFor(country, genre)
  const withCountry = (params: Record<string, string>) =>
    releaseCountry ? { ...params, country: releaseCountry } : params

  const base: Record<string, string> = {}
  if (style) base.style = style
  if (discogsGenre) base.genre = discogsGenre
  if (q) base.q = q

  const attempts: Attempt[] = [{ match: 'exact', params: withCountry(base) }]
  if (releaseCountry && style && !keepCountry) attempts.push({ match: 'global', params: base })
  attempts.push({ match: 'keyword', params: withCountry({ q: keyword ?? genre.name }) })

  const seen = new Set<string>()
  return attempts.filter(({ params }) => {
    const key = JSON.stringify(Object.entries(params).sort())
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchReleases(
  country: DiscogsCountry,
  genre: Genre,
  fetcher: SearchFetcher = browserFetcher,
  signal?: AbortSignal,
): Promise<ReleaseResult> {
  let best: ReleaseResult = { releases: [], match: 'none' }
  for (const attempt of buildAttempts(country, genre)) {
    const params = new URLSearchParams({
      type: 'master',
      per_page: String(PER_PAGE),
      // Undocumented but harmless if ignored: results are re-sorted locally either way.
      sort: 'have',
      sort_order: 'desc',
      ...attempt.params,
    })
    const { results } = await fetcher(params, signal)
    const releases = pickTopReleases(results ?? [])
    if (releases.length >= RESULTS_WANTED) return { releases, match: attempt.match }
    if (releases.length > best.releases.length) best = { releases, match: attempt.match }
  }
  return best
}

export function pickTopReleases(results: DiscogsSearchResult[], count = RESULTS_WANTED): Release[] {
  const ranked = results
    .flatMap((result) => {
      const release = normalizeResult(result)
      if (!release) return []
      const weight = release.artist === 'Various' ? COMPILATION_WEIGHT : 1
      const masterId = result.type === 'master' ? result.id : result.master_id
      const keys = [`${release.artist}|${release.title}`.toLowerCase()]
      if (masterId) keys.push(`master:${masterId}`)
      return [{ release, keys, score: release.popularity * weight }]
    })
    .sort((a, b) => b.score - a.score || (a.release.year ?? 9999) - (b.release.year ?? 9999))

  const seen = new Set<string>()
  const picked: Release[] = []
  for (const { release, keys } of ranked) {
    if (keys.some((key) => seen.has(key))) continue
    keys.forEach((key) => seen.add(key))
    picked.push(release)
    if (picked.length === count) break
  }
  return picked
}

export function normalizeResult(result: DiscogsSearchResult): Release | null {
  if ((result.type !== 'master' && result.type !== 'release') || !result.title) return null
  const { artist, title } = parseDiscogsTitle(result.title)
  const year = Number.parseInt(result.year ?? '', 10)
  const cover = [result.cover_image, result.thumb].find(isRealImage)
  return {
    id: result.id,
    artist,
    title,
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    coverUrl: cover,
    label: result.label?.[0],
    format: result.format ? FORMAT_PRIORITY.find((format) => result.format?.includes(format)) : undefined,
    discogsUrl: result.uri
      ? new URL(result.uri, 'https://www.discogs.com').toString()
      : `https://www.discogs.com/${result.type}/${result.id}`,
    popularity: result.community?.have ?? result.community?.want ?? 0,
  }
}

/** Splits Discogs' combined "Artist - Title" and strips its "(2)" disambiguators and "*" name-variation marks. */
export function parseDiscogsTitle(raw: string): { artist: string; title: string } {
  const separator = raw.indexOf(' - ')
  if (separator === -1) return { artist: 'Various', title: raw.trim() }
  const artist = raw
    .slice(0, separator)
    .replace(/\s*\(\d+\)/g, '')
    .replace(/\*/g, '')
    .trim()
  return { artist: artist || 'Unknown artist', title: raw.slice(separator + 3).trim() }
}

function isRealImage(url: string | undefined): url is string {
  return !!url && !url.includes('spacer.gif')
}

export function discogsWebSearchUrl(country: DiscogsCountry, genre: Genre): string {
  const { style, genre: discogsGenre, q } = genre.discogs
  const params = new URLSearchParams({ type: 'master', sort: 'have,desc' })
  if (style) params.set('style_exact', style)
  if (discogsGenre) params.set('genre_exact', discogsGenre)
  if (q) params.set('q', q)
  if (!style && !discogsGenre && !q) params.set('q', genre.discogs.keyword ?? genre.name)
  const releaseCountry = releaseCountryFor(country, genre)
  if (releaseCountry) params.set('country_exact', releaseCountry)
  return `https://www.discogs.com/search/?${params}`
}
