// Vercel Function that proxies the Discogs database search, so the personal access
// token never reaches the browser. vite.config.ts mounts the same handler for
// `vite dev` and `vite preview`, and scripts/verify-data.ts calls it directly.

const UPSTREAM = 'https://api.discogs.com/database/search'
const USER_AGENT = 'GlobalMusicMapper/1.0 +https://github.com/'
const ALLOWED_PARAMS = ['q', 'type', 'style', 'genre', 'country', 'per_page', 'page', 'sort', 'sort_order']
const MAX_PARAM_LENGTH = 100

export async function GET(request: Request): Promise<Response> {
  const token = process.env.DISCOGS_TOKEN
  if (!token) {
    return json(500, {
      error: 'missing_token',
      message: 'DISCOGS_TOKEN is not configured. Add it to .env.local (dev) or the Vercel project settings.',
    })
  }

  // Only forward the search parameters we use, so this can't be used as an open proxy.
  const incoming = new URL(request.url).searchParams
  const upstream = new URL(UPSTREAM)
  for (const key of ALLOWED_PARAMS) {
    const value = incoming.get(key)
    if (value) upstream.searchParams.set(key, value.slice(0, MAX_PARAM_LENGTH))
  }
  const perPage = Number(upstream.searchParams.get('per_page')) || 50
  upstream.searchParams.set('per_page', String(Math.min(Math.max(perPage, 1), 100)))

  let response: Response
  try {
    response = await fetch(upstream, {
      headers: {
        Authorization: `Discogs token=${token}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/vnd.discogs.v2.discogs+json',
      },
    })
  } catch {
    return json(502, { error: 'upstream_unreachable', message: 'Could not reach Discogs.' })
  }

  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' })
  if (response.ok) {
    // Identical searches are served from Vercel's edge cache for every visitor,
    // which keeps us far below Discogs' 60 requests/minute limit.
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
  } else {
    headers.set('Cache-Control', 'no-store')
  }
  if (response.status === 429) headers.set('Retry-After', response.headers.get('Retry-After') ?? '5')

  return new Response(await response.text(), { status: response.status, headers })
}

function json(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
