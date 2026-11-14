import type { Page } from '@playwright/test'

const ARTISTS = ['Ana Duarte', 'Os Ventos', 'Lia Moreno', 'Trio Calma', 'Ruy Sol']
const COLORS = [
  ['#f97316', '#7c3aed'],
  ['#06b6d4', '#1e3a8a'],
  ['#facc15', '#be123c'],
  ['#22c55e', '#0f172a'],
  ['#ec4899', '#312e81'],
]

function cover(index: number): string {
  const [from, to] = COLORS[index % COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="68" cy="34" r="18" fill="#fff" fill-opacity=".25"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** A believable Discogs search response whose titles echo the searched style. */
export function fakeSearchResponse(url: URL) {
  const term = url.searchParams.get('style') ?? url.searchParams.get('q') ?? url.searchParams.get('genre') ?? 'Music'
  return {
    pagination: { items: 5, page: 1, pages: 1, per_page: 100 },
    results: ARTISTS.map((artist, index) => ({
      id: 1000 + index,
      type: 'master',
      title: `${artist} - ${term} ${['Nights', 'Ao Vivo', 'Vol. 2', 'Sessions', 'Live'][index]}`,
      year: String(1959 + index * 4),
      cover_image: cover(index),
      uri: `/master/${1000 + index}`,
      label: ['Elenco'],
      format: ['Vinyl', 'LP', 'Album'],
      community: { have: 5000 - index * 700, want: 900 },
    })),
  }
}

export type DiscogsMock = { requests: URL[] }

export async function mockDiscogs(page: Page, respond?: (url: URL) => { status: number; body: unknown }): Promise<DiscogsMock> {
  const mock: DiscogsMock = { requests: [] }
  await page.route('**/api/discogs/search**', async (route) => {
    const url = new URL(route.request().url())
    mock.requests.push(url)
    const { status, body } = respond?.(url) ?? { status: 200, body: fakeSearchResponse(url) }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return mock
}

/** A chart whose titles say which chart was asked for, so tests can tell national from city charts. */
export function fakeChart(url: URL) {
  const source = url.searchParams.get('source') ?? 'apple'
  const where = url.searchParams.get('city') ?? url.searchParams.get('cc') ?? url.searchParams.get('country') ?? 'x'
  const total = where === 'world' ? 200 : 25
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const limit = Number(url.searchParams.get('limit') ?? 25)
  const origins = url.searchParams.get('origins') === '1' ? ['US', 'GB', 'US', 'HU', undefined] : []
  return {
    source,
    scope: url.searchParams.get('city') ? 'city' : 'country',
    period: source === 'apple' ? 'most played today' : 'past 7 days',
    total,
    tracks: Array.from({ length: Math.min(limit, total - offset) }, (_, i) => {
      const index = offset + i
      return {
        rank: index + 1,
        // Below rank 15 every chart has the same songs, so comparisons find something in common.
        title: index >= 15 ? `Shared hit ${index + 1}` : `${where} hit ${index + 1}`,
        artist: ARTISTS[index % ARTISTS.length],
        artwork: cover(index),
        deezerId: 5000 + index,
        origin: origins[index % 5],
      }
    }),
  }
}

/** Matches src/utils/songKey.ts for these simple names. */
const key = (artist: string, title: string) => `${artist.toLowerCase().replace(/[^a-z0-9]/g, '')}|${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`

/** Hungary's number one is also charting in France (#4) and the United States (#9). */
export const fakeIndex = () => ({
  updated: new Date().toISOString(),
  complete: true,
  charts: {
    HU: [[1, key(ARTISTS[0], 'hu hit 1')]],
    FR: [[4, key(ARTISTS[0], 'hu hit 1')]],
    US: [[9, key(ARTISTS[0], 'hu hit 1')]],
    DE: [[1, key('Someone', 'Else')]],
  },
})

export type MusicMock = { charts: URL[]; previews: URL[] }

/** Mocks /api/charts and /api/preview; previews play a short silent clip. */
export async function mockMusic(page: Page, respondChart?: (url: URL) => { status: number; body: unknown }): Promise<MusicMock> {
  const mock: MusicMock = { charts: [], previews: [] }
  await page.route('**/api/charts**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('source') === 'index') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(fakeIndex()) })
      return
    }
    mock.charts.push(url)
    const { status, body } = respondChart?.(url) ?? { status: 200, body: fakeChart(url) }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/api/preview**', async (route) => {
    const url = new URL(route.request().url())
    mock.previews.push(url)
    const name = url.searchParams.get('artist') ?? `Track ${url.searchParams.get('track')}`
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ title: `Best of ${name}`, artist: name, preview: '/__test/preview.wav', cover: cover(1) }),
    })
  })
  await page.route('**/__test/preview.wav', (route) => route.fulfill({ contentType: 'audio/wav', body: silentWav() }))
  // Deezer's catalogue: any song, here one that never topped a chart, by a Hungarian band.
  await page.route('**/api/search?**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? ''
    const tracks = /gy(ö|o)ngy/i.test(q) ? [{ id: 9001, title: 'Gyöngyhajú lány', artist: 'Omega', artistId: 801, album: 'Omega Red Star' }] : []
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ artists: [], tracks }) })
  })
  // An artist's Deezer page: two well-known songs and three releases, the first a reissue.
  await page.route('**/api/discography**', async (route) => {
    const url = new URL(route.request().url())
    const name = url.searchParams.get('name') ?? 'Artist'
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        name,
        picture: cover(3),
        top: [
          { id: 7001, title: `${name} hit one`, album: 'Best of', cover: cover(4) },
          { id: 7002, title: `${name} hit two`, album: 'Best of', cover: cover(5) },
        ],
        releases: [
          { title: 'Közel a naphoz', date: '1972-05-01', type: 'album' },
          { title: 'Second', date: '1975-01-01', type: 'album' },
          { title: 'Late single', date: '1999-03-03', type: 'single' },
        ],
      }),
    })
  })
  // Artist photos and film posters come from Wikimedia; tests stay offline.
  await page.route(/^https:\/\/[a-z.]*wikimedia\.org\//, (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: decodeURIComponent(cover(2).split(',')[1]) }),
  )
  return mock
}

/** Half a second of silence. */
function silentWav(): Buffer {
  const samples = 4000
  const buffer = Buffer.alloc(44 + samples)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(8000, 28)
  buffer.writeUInt16LE(1, 32)
  buffer.writeUInt16LE(8, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples, 40)
  buffer.fill(128, 44)
  return buffer
}
