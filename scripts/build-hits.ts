// Builds the time machine's hits: for each country and year, the songs that were number one in its
// singles chart, read from English Wikipedia's "List of number-one singles/hits of …" pages. Hungary had
// no chart before the 1990s, so its 1960s–70s years list the songs of the Táncdalfesztivál instead (from
// Hungarian Wikipedia).
//
//   public/data/hits/index.json    { "DE": [1956, 1957, …], … }       which years each country has
//   public/data/hits/<iso2>.json   { "1965": { page, kind, songs: [[title, artist, weeks, note?], …] } }
//   public/data/hits/songs.json    [[title, artist, [[iso2, year, weeks], …]], …]   for searching songs and artists
//   public/data/hits/alltime.json  the all-time Top 30 (see below), with each artist's origin from
//                                  api/_data/artists.json when that exists (npm run build:artists)
//
// Page sources are fetched 50 at a time as wikitext (rendered HTML would take a request per page, and
// Wikipedia throttles anonymous clients to a few requests a minute).
//
//   npx tsx scripts/build-hits.ts            fetch what isn't cached yet (a few minutes from scratch)
//   npx tsx scripts/build-hits.ts --offline  rebuild from scripts/.cache/hits only
//   npx tsx scripts/build-hits.ts --dry      only list which page each country's years come from
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import world from '../src/data/world.json' with { type: 'json' }
import { anySongKey, leadArtist, nameKey } from '../src/utils/hitSearch.ts'
import { chartRows, titleYears, wikitextTables } from './wikitable.ts'

const args = process.argv.slice(2)
const offline = args.includes('--offline')
const dry = args.includes('--dry')

const CACHE = 'scripts/.cache/hits'
const OUT = 'public/data/hits'
const USER_AGENT = 'GlobalMusicMapper-data/1.0 (educational project)'
const MAX_SONGS = 40
mkdirSync(CACHE, { recursive: true })

type Song = [title: string, artist: string, weeks: number, note?: string]
export type HitYear = { page: string; kind: 'chart' | 'festival'; songs: Song[] }

// ── Wikipedia ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let lastRequest = 0

/** One API request at a time, a second apart, waiting as long as Wikipedia asks when it says "too many requests". */
async function wiki<T>(lang: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
  for (const [key, value] of Object.entries({ ...params, format: 'json', formatversion: '2' })) url.searchParams.set(key, value)
  for (let attempt = 1; ; attempt++) {
    await sleep(Math.max(0, lastRequest + 1100 - Date.now()))
    lastRequest = Date.now()
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) }).catch(() => null)
    if (response?.ok) return (await response.json()) as T
    if (response?.status === 429 && attempt < 30) {
      await sleep((Number(response.headers.get('retry-after')) || 5) * 1000)
      continue
    }
    if (attempt >= 6) throw new Error(`Wikipedia ${response?.status ?? 'unreachable'}: ${url}`)
    await sleep(3_000 * attempt)
  }
}

function cachedJson<T>(name: string, load: () => Promise<T>): Promise<T> {
  const file = join(CACHE, `${name}.json`)
  if (existsSync(file)) return Promise.resolve(JSON.parse(readFileSync(file, 'utf8')) as T)
  if (offline) throw new Error(`--offline: ${file} is not cached`)
  return load().then((value) => {
    writeFileSync(file, JSON.stringify(value))
    return value
  })
}

async function categoryMembers(category: string, type: 'page' | 'subcat'): Promise<string[]> {
  const out: string[] = []
  let cont: Record<string, string> = {}
  for (;;) {
    const data = await wiki<{ query: { categorymembers: { title: string }[] }; continue?: Record<string, string> }>('en', {
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: type,
      cmlimit: '500',
      ...cont,
    })
    out.push(...data.query.categorymembers.map((member) => member.title))
    if (!data.continue) return out
    cont = data.continue
  }
}

const sourceFile = (lang: string, title: string) => join(CACHE, `${lang}-${title.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 150)}.wiki`)

type RevisionsResponse = {
  query: {
    pages: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[]
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
  }
}

/** Fetches the wikitext of every page not cached yet, 50 to a request (an empty file marks a missing page). */
async function fetchSources(lang: string, titles: string[]): Promise<void> {
  const wanted = [...new Set(titles)].filter((title) => !existsSync(sourceFile(lang, title)))
  if (offline || !wanted.length) return
  for (let start = 0; start < wanted.length; start += 50) {
    const batch = wanted.slice(start, start + 50)
    const data = await wiki<RevisionsResponse>(lang, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: batch.join('|') })
    // Back from the page Wikipedia returns to the title that was asked for.
    const asked = new Map<string, string>()
    for (const { from, to } of [...(data.query.normalized ?? []), ...(data.query.redirects ?? [])]) asked.set(to, asked.get(from) ?? from)
    for (const page of data.query.pages) writeFileSync(sourceFile(lang, asked.get(page.title) ?? page.title), page.revisions?.[0]?.slots.main.content ?? '')
    console.log(`  ${Math.min(start + 50, wanted.length)}/${wanted.length} ${lang} pages`)
  }
}

function pageSource(lang: string, title: string): string | null {
  const file = sourceFile(lang, title)
  if (!existsSync(file)) {
    if (offline) throw new Error(`--offline: ${file} is not cached`)
    return null
  }
  return readFileSync(file, 'utf8') || null
}

// ── Which page for which year ──────────────────────────────────────────────────

const ROOT = 'Category:Lists of number-one songs'
const ALIASES: Record<string, string> = { Netherlands: 'NL', 'Czech Republic': 'CZ' }
const iso2ByName = new Map(world.map((country) => [country.name, country.iso2]))

// Albums, genre and format charts are not "the" chart of a country.
const EXCLUDE =
  /\b(albums?|EPs?|extended plays?|DVDs?|videos?|books?|films?|box office|country|R&B|rhythm|soul|dance|club|rock|metal|latin|tropical|regional|christian|gospel|jazz|rap|hip[- ]hop|alternative|adult|easy listening|ringtones?|catalog(ue)?|indie|classical|independent|compilations?|vinyl|budget|mainstream|urban|reggae|electronic|holiday|christmas|year-end|by artist|artists|records|labels?|top[- ](ten|five|10|5)|bubbling|heatseekers|kids|children|anime|trot|enka|Spanish-language|French-language|English-language|international|foreign|regional mexican|Flanders|Wallonia|Hot Latin|Japan Hot 100 Airplay)\b/i
// Kept only when a country has nothing else for that year.
const WEAKER = /\b(airplay|radio|digital|download|streaming|cash box|record world|music vendor|television|TV)\b/i
const PREFERRED: Record<string, RegExp> = {
  US: /Billboard (Hot 100|number-one singles|Best Sellers)/i,
  GB: /UK (singles chart|Singles Chart) number ones/i,
  JP: /Oricon/i,
  CA: /number-one singles of \d{4} \(Canada\)|Canadian Hot 100/i,
  AU: /number-one singles (of|in) .*Australia|ARIA/i,
  NL: /Dutch Top 40|Single Top 100/i,
  BE: /Ultratop 50/i,
}

function score(iso2: string, title: string): number {
  let value = 0
  if (PREFERRED[iso2]?.test(title)) value += 10
  if (WEAKER.test(title)) value -= 5
  if (titleYears(title).length === 1) value += 1
  return value - title.length / 1000
}

type Plan = Map<string, Map<number, string>> // iso2 → year → page title

async function plan(): Promise<Plan> {
  const categories = await cachedJson('categories', () => categoryMembers(ROOT, 'subcat'))
  const result: Plan = new Map()
  for (const category of categories) {
    const name = category.replace(/^Category:Lists of number-one songs in (the )?/, '')
    const iso2 = ALIASES[name] ?? iso2ByName.get(name)
    if (!iso2) {
      console.log(`  skipped ${category}`)
      continue
    }
    const pages = await cachedJson(`pages-${iso2}`, async () => {
      const direct = await categoryMembers(category, 'page')
      const nested: string[] = []
      for (const sub of await categoryMembers(category, 'subcat')) nested.push(...(await categoryMembers(sub, 'page')))
      return [...new Set([...direct, ...nested])]
    })
    const byYear = new Map<number, string>()
    for (const title of pages) {
      if (EXCLUDE.test(title) || !/number[- ]one|number ones|No\. ?1/i.test(title)) continue
      for (const year of titleYears(title)) {
        if (year < 1940 || year > new Date().getFullYear()) continue
        const current = byYear.get(year)
        if (!current || score(iso2, title) > score(iso2, current)) byYear.set(year, title)
      }
    }
    if (byYear.size) result.set(iso2, byYear)
  }
  return result
}

// ── Songs ──────────────────────────────────────────────────────────────────────

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
/** The same song whichever way round a double A-side is listed ("Hound Dog / Don't Be Cruel"). */
const songKey = (title: string, artist: string) => `${title.split(' / ').map(fold).sort().join('/')}|${fold(artist)}`


/** Number ones for the given years of one page: weeks at number one in that year, most first. */
function chartYears(lang: string, title: string, years: number[]): Map<number, HitYear> {
  const source = pageSource(lang, title)
  const out = new Map<number, HitYear>()
  if (!source) return out
  const pageYears = titleYears(title)
  // Decade pages give each year its own table under a heading; single-year pages give the year in the title.
  const rows = wikitextTables(source).flatMap((table) => chartRows(table.html, pageYears.length === 1 ? pageYears[0] : table.year))
  for (const year of years) {
    const songs = new Map<string, { title: string; artist: string; weeks: number; note?: string; order: number }>()
    const counted = new Set<number>()
    for (const row of rows) {
      if (row.year !== year) continue
      const key = songKey(row.title, row.artist)
      const song = songs.get(key) ?? { title: row.title, artist: row.artist, weeks: 0, order: songs.size }
      // A "weeks at number one" column counts once per entry; otherwise every row is a week.
      if (row.weeks !== undefined) song.weeks += counted.has(row.entry) ? 0 : row.weeks
      else song.weeks++
      counted.add(row.entry)
      song.note ??= row.note
      songs.set(key, song)
    }
    if (!songs.size) continue
    const list = [...songs.values()].sort((a, b) => b.weeks - a.weeks || a.order - b.order).slice(0, MAX_SONGS)
    out.set(year, { page: `${lang}:${title}`, kind: 'chart', songs: list.map((s) => [s.title, s.artist, s.weeks]) })
  }
  return out
}

// The Táncdalfesztivál of Hungarian Television, with its prize winners first.
const FESTIVALS = ['Táncdalfesztivál ’66', 'Táncdalfesztivál ’67', 'Táncdalfesztivál ’68', 'Táncdalfesztivál ’69', 'Táncdalfesztivál ’71', 'Táncdalfesztivál ’72']
const prizeRank = (note?: string) => (note ? Number(/(\d+)\./.exec(note)?.[1] ?? 9) : 99)

function festivalYear(title: string): [number, HitYear] | null {
  const source = pageSource('hu', title)
  const [year] = titleYears(title)
  if (!source || !year) return null
  const songs = new Map<string, { title: string; artist: string; note?: string; order: number }>()
  for (const row of wikitextTables(source).flatMap((table) => chartRows(table.html, year))) {
    const key = songKey(row.title, row.artist)
    const song = songs.get(key) ?? { title: row.title, artist: row.artist, order: songs.size }
    song.note ??= row.note
    songs.set(key, song)
  }
  const list = [...songs.values()].sort((a, b) => prizeRank(a.note) - prizeRank(b.note) || a.order - b.order).slice(0, MAX_SONGS)
  return list.length ? [year, { page: `hu:${title}`, kind: 'festival', songs: list.map((s) => (s.note ? [s.title, s.artist, 0, s.note] : [s.title, s.artist, 0])) }] : null
}

// ── Build ──────────────────────────────────────────────────────────────────────

const plans = await plan()
const pageCount = new Set([...plans.values()].flatMap((years) => [...years.values()])).size
console.log(`${plans.size} countries, ${pageCount} pages`)
if (dry) {
  for (const [iso2, years] of plans) {
    const pages = new Map<string, number[]>()
    for (const [year, title] of years) pages.set(title, [...(pages.get(title) ?? []), year])
    console.log(`${iso2}: ${[...pages].map(([title, ys]) => `${title} [${Math.min(...ys)}–${Math.max(...ys)}]`).join(' · ')}`)
  }
  process.exit(0)
}

await fetchSources('en', [...plans.values()].flatMap((years) => [...years.values()]))
await fetchSources('hu', FESTIVALS)

const hits = new Map<string, Map<number, HitYear>>()
for (const [iso2, years] of plans) {
  const country = new Map<number, HitYear>()
  const byPage = new Map<string, number[]>()
  for (const [year, title] of years) byPage.set(title, [...(byPage.get(title) ?? []), year])
  for (const [title, pageYears] of byPage) {
    try {
      for (const [year, hit] of chartYears('en', title, pageYears)) country.set(year, hit)
    } catch (error) {
      console.warn(`  ${title}: ${(error as Error).message}`)
    }
  }
  if (country.size) hits.set(iso2, country)
}

const hungary = hits.get('HU') ?? new Map<number, HitYear>()
for (const title of FESTIVALS) {
  try {
    const entry = festivalYear(title)
    if (entry && !hungary.has(entry[0])) hungary.set(entry[0], entry[1])
  } catch (error) {
    console.warn(`  ${title}: ${(error as Error).message}`)
  }
}
if (hungary.size) hits.set('HU', hungary)

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const index: Record<string, number[]> = {}
for (const [iso2, years] of [...hits].sort(([a], [b]) => a.localeCompare(b))) {
  const sorted = [...years].sort(([a], [b]) => a - b)
  index[iso2] = sorted.map(([year]) => year)
  writeFileSync(join(OUT, `${iso2.toLowerCase()}.json`), JSON.stringify(Object.fromEntries(sorted)))
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))

// Every song with where and when it was a number one (or a festival song), most widespread first. Its
// title and artist are written the way most of its countries write them.
const everywhere = new Map<string, { names: Map<string, number>; entries: [string, number, number][] }>()
for (const [iso2, years] of hits) {
  for (const [year, { songs }] of years) {
    for (const [title, artist, weeks] of songs) {
      const key = anySongKey(title, artist)
      const song = everywhere.get(key) ?? { names: new Map<string, number>(), entries: [] as [string, number, number][] }
      const name = `${title}\u0000${artist}`
      song.names.set(name, (song.names.get(name) ?? 0) + 1)
      song.entries.push([iso2, year, weeks])
      everywhere.set(key, song)
    }
  }
}
const songIndex = [...everywhere.values()]
  .map(({ names, entries }) => {
    const [title, artist] = [...names].sort((a, b) => b[1] - a[1])[0][0].split('\u0000')
    return [title, artist, entries.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))] as const
  })
  .sort((a, b) => b[2].length - a[2].length || b[2].reduce((s, e) => s + e[2], 0) - a[2].reduce((s, e) => s + e[2], 0))
writeFileSync(join(OUT, 'songs.json'), JSON.stringify(songIndex))
console.log(`Wrote ${songIndex.length} songs to ${join(OUT, 'songs.json')}`)

// The all-time Top 30: the songs that topped the most charts, as a share of the countries that had a
// chart at the time (more countries publish one now than in the 1960s), damped so a year with only two
// charts can't make a song look universal. Ties go to more weeks at number one in all.
const ALL_TIME = 30
const DAMPING = 4
const charts = new Map<number, number>()
for (const years of Object.values(index)) for (const year of years) charts.set(year, (charts.get(year) ?? 0) + 1)
type ArtistRow = [string, string, string, string, number, 'p' | 'g', number, number, string, string, string?]
const artistRows = existsSync('api/_data/artists.json') ? (JSON.parse(readFileSync('api/_data/artists.json', 'utf8')) as ArtistRow[]) : []
const origins = new Map<string, ArtistRow>()
// Best known first, so a name shared by two artists goes to the better known.
for (const row of artistRows) for (const name of [row[0], row[10]]) if (name && !origins.has(nameKey(name))) origins.set(nameKey(name), row)
const allTime = songIndex
  .map(([title, artist, entries]) => {
    const countries = new Set(entries.map(([iso2]) => iso2)).size
    const coverage = Math.max(...entries.map(([, year]) => charts.get(year) ?? 0))
    const weeks = entries.reduce((sum, [, , w]) => sum + w, 0)
    return { title, artist, entries, countries, coverage, weeks, first: Math.min(...entries.map(([, year]) => year)), score: countries / (coverage + DAMPING) }
  })
  .sort((a, b) => b.score - a.score || b.weeks - a.weeks)
  .slice(0, ALL_TIME)
  .map(({ score: _score, ...song }) => {
    const row = origins.get(nameKey(leadArtist(song.artist)))
    const origin = row && { name: row[0], iso2: row[1], cityId: row[2], city: row[3], year: row[4] || undefined, kind: row[5], deezer: row[7] || undefined, id: row[8], genres: row[9] ? row[9].split(', ') : [], ...(row[10] ? { alias: row[10] } : {}) }
    return origin ? { ...song, origin } : song
  })
writeFileSync(join(OUT, 'alltime.json'), JSON.stringify(allTime))
console.log(`Wrote the all-time Top ${ALL_TIME} (${allTime.filter((song) => 'origin' in song).length} with the artist's origin)`)
const total = Object.values(index).reduce((sum, years) => sum + years.length, 0)
console.log(`Wrote ${Object.keys(index).length} countries, ${total} country-years to ${OUT}`)
