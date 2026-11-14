// Builds the artist search index: every musician and band on the globe's places (scripts/build-world-data.ts,
// the best known 400 born in each country), plus from Wikidata every Hungarian musician and band and the
// world's better-known ones, with where and when they were born or formed. It is a few MB, so it stays on
// the server: api/artists.ts searches it and sends back only the matches.
//
//   api/_data/artists.json   [[name, iso2, cityId, cityName, year, kind, sitelinks, deezerId, wikidataId, genres, alias], …]
//                            best known first; year and deezerId 0 when unknown, cityId and cityName "" when
//                            only the country is known; genres up to two; alias the other-language name
//
//   npx tsx scripts/build-artists.ts            (Wikidata answers are cached in scripts/.cache/artists)
//   npx tsx scripts/build-artists.ts --offline  from the cache only
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CountryPlaces } from '../src/types/places.ts'

const offline = process.argv.includes('--offline')
const PLACES = 'public/data/places'
const OUT = 'api/_data/artists.json'
const CACHE = 'scripts/.cache/artists'
const SPARQL = 'https://qlever.dev/api/wikidata'
const USER_AGENT = 'GlobalMusicMapper-data/1.0 (educational project)'
mkdirSync(CACHE, { recursive: true })
mkdirSync('api/_data', { recursive: true })

type Row = [name: string, iso2: string, cityId: string, cityName: string, year: number, kind: 'p' | 'g', sitelinks: number, deezer: number, id: string, genres: string, alias: string]

// ── Wikidata ───────────────────────────────────────────────────────────────────

type Binding = Record<string, { value: string } | undefined>
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`

async function sparql(name: string, query: string): Promise<Binding[]> {
  const file = join(CACHE, `${name}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as Binding[]
  if (offline) throw new Error(`--offline: ${file} is not cached`)
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(SPARQL, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query: PREFIXES + query }),
      signal: AbortSignal.timeout(120_000),
    }).catch(() => null)
    if (response?.ok) {
      const rows = ((await response.json()) as { results: { bindings: Binding[] } }).results.bindings
      writeFileSync(file, JSON.stringify(rows))
      return rows
    }
    if (attempt >= 5) throw new Error(`QLever ${response?.status ?? 'unreachable'} for ${name}`)
    await sleep(5_000 * attempt)
  }
}

const qid = (binding: { value: string } | undefined) => binding?.value.split('/').pop() ?? ''

/** Who to look up: musicians (any subclass of musician) and musical groups, Hungarian or well known. */
async function candidates(): Promise<{ ids: Map<string, 'p' | 'g'>; hungarian: Set<string> }> {
  const musicians = `{ SELECT ?occ WHERE { ?occ wdt:P279* wd:Q639669 } } ?artist wdt:P106 ?occ ; wikibase:sitelinks ?links .`
  const groups = `{ SELECT ?type WHERE { ?type wdt:P279* wd:Q215380 } } ?artist wdt:P31 ?type ; wikibase:sitelinks ?links .`
  const sets = {
    'hu-persons': await sparql('hu-persons', `SELECT DISTINCT ?artist WHERE { ${musicians} ?artist wdt:P27 wd:Q28 . }`),
    'hu-groups': await sparql('hu-groups', `SELECT DISTINCT ?artist WHERE { ${groups} ?artist wdt:P495 wd:Q28 . }`),
    'world-persons': await sparql('world-persons', `SELECT DISTINCT ?artist WHERE { ${musicians} FILTER(?links >= 15) }`),
    'world-groups': await sparql('world-groups', `SELECT DISTINCT ?artist WHERE { ${groups} FILTER(?links >= 10) }`),
  }
  const ids = new Map<string, 'p' | 'g'>()
  for (const [set, rows] of Object.entries(sets)) for (const row of rows) ids.set(qid(row.artist), set.endsWith('groups') ? 'g' : 'p')
  const hungarian = new Set([...sets['hu-persons'], ...sets['hu-groups']].map((row) => qid(row.artist)))
  return { ids, hungarian }
}

const HOSPITAL = /hospital|infirmary|clinic|maternity|medical cent|kórház|klinik/i

type Details = { en: string; hu: string; year: number; place: string; placeName: string; iso2: string; deezer: number; links: number; genres: string[] }

/** Names, birth or formation year and place (with its country), Deezer id and genres, 400 artists a query. */
async function details(ids: string[]): Promise<Map<string, Details>> {
  const out = new Map<string, Details>()
  for (let start = 0; start < ids.length; start += 400) {
    const batch = ids.slice(start, start + 400)
    const values = batch.map((id) => `wd:${id}`).join(' ')
    const rows = await sparql(
      `details2-${batch[0]}-${batch.length}`,
      `SELECT ?artist ?links ?en ?hu ?date ?place ?placeName ?iso2 ?deezer ?parent ?parentName WHERE {
        VALUES ?artist { ${values} }
        ?artist wikibase:sitelinks ?links .
        OPTIONAL { ?artist rdfs:label ?en FILTER(LANG(?en) = "en") }
        OPTIONAL { ?artist rdfs:label ?hu FILTER(LANG(?hu) = "hu") }
        OPTIONAL { { ?artist wdt:P569 ?date } UNION { ?artist wdt:P571 ?date } }
        OPTIONAL {
          { ?artist wdt:P19 ?place } UNION { ?artist wdt:P740 ?place }
          OPTIONAL { ?place rdfs:label ?placeName FILTER(LANG(?placeName) = "en") }
          OPTIONAL { ?place wdt:P17 ?country . ?country wdt:P297 ?iso2 }
          OPTIONAL { ?place wdt:P131 ?parent . ?parent rdfs:label ?parentName FILTER(LANG(?parentName) = "en") }
        }
        OPTIONAL { ?artist wdt:P2722 ?deezer }
      }`,
    )
    const genres = await sparql(
      `genres-${batch[0]}-${batch.length}`,
      `SELECT ?artist ?genre WHERE { VALUES ?artist { ${values} } ?artist wdt:P136 ?g . ?g rdfs:label ?genre FILTER(LANG(?genre) = "en") }`,
    )
    for (const row of rows) {
      const id = qid(row.artist)
      const known = out.get(id)
      const year = row.date ? Number(/^-?\d+/.exec(row.date.value)?.[0] ?? 0) : 0
      const entry: Details = known ?? { en: '', hu: '', year: 0, place: '', placeName: '', iso2: '', deezer: 0, links: Number(row.links?.value ?? 0), genres: [] }
      entry.en ||= row.en?.value ?? ''
      entry.hu ||= row.hu?.value ?? ''
      if (year > 0 && (!entry.year || year < entry.year)) entry.year = year
      // A place in a country we can show beats one without. A hospital (Ed Sheeran's "Royal Halifax
      // Infirmary") stands for the town it is in.
      if (row.place && (!entry.place || (!entry.iso2 && row.iso2))) {
        const hospital = HOSPITAL.test(row.placeName?.value ?? '') && row.parent
        entry.place = qid(hospital ? row.parent : row.place)
        entry.placeName = (hospital ? row.parentName?.value : row.placeName?.value) ?? ''
        entry.iso2 = row.iso2?.value ?? ''
      }
      entry.deezer ||= Number(row.deezer?.value ?? 0) || 0
      out.set(id, entry)
    }
    for (const row of genres) {
      const entry = out.get(qid(row.artist))
      if (entry && entry.genres.length < 2 && row.genre && !entry.genres.includes(row.genre.value)) entry.genres.push(row.genre.value)
    }
    if ((start / 400) % 10 === 0) console.log(`  ${Math.min(start + 400, ids.length)}/${ids.length} artists`)
  }
  return out
}

// ── Build ──────────────────────────────────────────────────────────────────────

// The globe's places first: their cities are the ones the globe can open.
const rows = new Map<string, Row>()
for (const file of readdirSync(PLACES).filter((name) => name.endsWith('.json'))) {
  const places = JSON.parse(readFileSync(join(PLACES, file), 'utf8')) as CountryPlaces
  for (const city of places.cities) {
    for (const artist of city.artists) {
      // An artist is listed once, at their birthplace or place of formation.
      if (rows.has(artist.id)) continue
      const genres = (artist.genres ?? []).filter((genre) => !/porn/i.test(genre)).slice(0, 2).join(', ')
      rows.set(artist.id, [artist.name, places.iso2, city.id, city.name, artist.year ?? 0, artist.kind, artist.sl, artist.deezer ?? 0, artist.id, genres, ''])
    }
  }
}
const fromPlaces = rows.size

const { ids, hungarian } = await candidates()
// Hungarian artists already on the places still need their Hungarian name, and ones born in a "city"
// that is really a hospital need its town.
const inHospital = [...rows.values()].filter((row) => HOSPITAL.test(row[3])).map((row) => row[8])
const wanted = [...new Set([...[...ids.keys()].filter((id) => !rows.has(id) || hungarian.has(id)), ...inHospital])]
console.log(`${fromPlaces} artists from the places; looking up ${wanted.length} on Wikidata`)
const found = await details(wanted)

for (const [id, entry] of found) {
  const isHungarian = hungarian.has(id)
  // Hungarian artists go by their Hungarian name ("Kovács Kati"); the English one stays searchable.
  const name = (isHungarian && entry.hu) || entry.en || entry.hu
  const alias = name === entry.en ? (entry.hu !== entry.en ? entry.hu : '') : entry.en
  const known = rows.get(id)
  if (known) {
    const updated = [...known] as Row
    if (isHungarian && entry.hu && entry.hu !== known[0]) {
      updated[0] = entry.hu
      updated[10] = known[0]
    }
    if (HOSPITAL.test(known[3]) && entry.placeName && !HOSPITAL.test(entry.placeName)) {
      updated[2] = entry.place
      updated[3] = entry.placeName
    }
    rows.set(id, updated)
    continue
  }
  if (!name || /^Q\d+$/.test(name)) continue
  // Hungarians without a known birthplace are still Hungarian.
  const iso2 = entry.iso2 || (isHungarian ? 'HU' : '')
  if (!iso2) continue
  const genres = entry.genres.filter((genre) => !/porn/i.test(genre)).join(', ')
  rows.set(id, [name, iso2, entry.iso2 ? entry.place : '', entry.iso2 ? entry.placeName : '', entry.year, ids.get(id) ?? 'p', entry.links, entry.deezer, id, genres, alias])
}

const sorted = [...rows.values()].sort((a, b) => b[6] - a[6] || a[0].localeCompare(b[0]))
writeFileSync(OUT, JSON.stringify(sorted))
console.log(`Wrote ${sorted.length} artists (${sorted.length - fromPlaces} from Wikidata) to ${OUT}`)
