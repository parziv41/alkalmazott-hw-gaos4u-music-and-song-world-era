// Builds public/data/gazetteer.json: places to search for and to mark on the globe, beyond the
// cities that have artists or films.
//
//   Hungary          every official settlement (towns, villages, Budapest's districts), from Wikidata's
//                    KSH codes, with population and county
//   rest of Europe   towns and cities of 15,000 people or more, from GeoNames (cities15000)
//   rest of world    cities of 100,000 or more, from GeoNames
//
//   npx tsx scripts/build-gazetteer.ts
//
// GeoNames data is CC BY 4.0 (https://www.geonames.org); Wikidata is CC0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import world from '../src/data/world.json' with { type: 'json' }

const CACHE = 'scripts/.cache/geonames'
const USER_AGENT = 'GlobalMusicMapper-data/1.0 (educational project)'
const EUROPE_MIN = 15_000
const WORLD_MIN = 100_000
// Sections of a city, and historical, abandoned or destroyed places.
const SKIPPED_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH'])
mkdirSync(CACHE, { recursive: true })

const selectable = new Set((world as { iso2: string }[]).map((country) => country.iso2))

async function download(file: string): Promise<Buffer> {
  const path = join(CACHE, file)
  if (!existsSync(path)) {
    const response = await fetch(`https://download.geonames.org/export/dump/${file}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`GeoNames ${file}: ${response.status}`)
    writeFileSync(path, Buffer.from(await response.arrayBuffer()))
  }
  return readFileSync(path)
}

/** Reads one file out of a zip archive (stored or deflated), so no unzip tool is needed. */
function unzipEntry(zip: Buffer, name: string): string {
  let end = zip.length - 22
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Not a zip file')
  let offset = zip.readUInt32LE(end + 16)
  const count = zip.readUInt16LE(end + 10)
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(offset + 10)
    const size = zip.readUInt32LE(offset + 20)
    const nameLength = zip.readUInt16LE(offset + 28)
    const extraLength = zip.readUInt16LE(offset + 30)
    const commentLength = zip.readUInt16LE(offset + 32)
    const local = zip.readUInt32LE(offset + 42)
    if (zip.toString('utf8', offset + 46, offset + 46 + nameLength) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const data = zip.subarray(start, start + size)
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8')
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  throw new Error(`${name} not found in archive`)
}

const round = (value: number) => Math.round(value * 1e4) / 1e4

/** [id, name, iso2, lat, lon, population, region] */
type Row = [string, string, string, number, number, number, string]
const rows: Row[] = []

// ── Hungary: every official settlement ─────────────────────────────────────────

const hungaryFile = join('scripts/.cache', 'hu-settlements.json')
type Binding = Record<string, { value: string } | undefined>
let hungary: Binding[]
if (existsSync(hungaryFile)) {
  hungary = JSON.parse(readFileSync(hungaryFile, 'utf8')) as Binding[]
} else {
  const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?s (SAMPLE(?nameHu) AS ?name) (SAMPLE(?coord) AS ?c) (MAX(?pop) AS ?population) (SAMPLE(?countyHu) AS ?county) WHERE {
  ?s wdt:P939 ?ksh ; wdt:P625 ?coord .
  OPTIONAL { ?s rdfs:label ?nameHu . FILTER(LANG(?nameHu) = "hu") }
  OPTIONAL { ?s wdt:P1082 ?pop }
  OPTIONAL { ?s wdt:P131 ?district . ?district wdt:P131 ?countyItem . ?countyItem wdt:P31 wd:Q188604 .
             ?countyItem rdfs:label ?countyHu . FILTER(LANG(?countyHu) = "hu") }
} GROUP BY ?s`
  const response = await fetch('https://qlever.dev/api/wikidata', {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    body: new URLSearchParams({ query }),
  })
  if (!response.ok) throw new Error(`SPARQL ${response.status}`)
  hungary = ((await response.json()) as { results: { bindings: Binding[] } }).results.bindings
  writeFileSync(hungaryFile, JSON.stringify(hungary))
}
for (const row of hungary) {
  const match = row.c?.value.match(/point\(([-\d.eE]+) ([-\d.eE]+)\)/i)
  const name = row.name?.value
  if (!match || !name) continue
  rows.push([
    row.s!.value.split('/').pop()!,
    name,
    'HU',
    round(Number(match[2])),
    round(Number(match[1])),
    Math.round(Number(row.population?.value) || 0),
    row.county?.value.replace(/ (vár)?megye$/, '') ?? (name.startsWith('Budapest') ? 'Budapest' : ''),
  ])
}
const hungarianCount = rows.length

// ── Elsewhere: GeoNames cities ─────────────────────────────────────────────────

const continents = new Map<string, string>()
for (const line of (await download('countryInfo.txt')).toString('utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const cells = line.split('\t')
  continents.set(cells[0], cells[8])
}
const regions = new Map<string, string>()
for (const line of (await download('admin1CodesASCII.txt')).toString('utf8').split('\n')) {
  const [code, name] = line.split('\t')
  if (code && name) regions.set(code, name)
}

for (const line of unzipEntry(await download('cities15000.zip'), 'cities15000.txt').split('\n')) {
  const cells = line.split('\t')
  if (cells.length < 15) continue
  const [id, name, , , lat, lon, featureClass, featureCode, iso2, , admin1] = cells
  const population = Number(cells[14]) || 0
  if (iso2 === 'HU' || featureClass !== 'P' || SKIPPED_CODES.has(featureCode) || !selectable.has(iso2)) continue
  const minimum = continents.get(iso2) === 'EU' ? EUROPE_MIN : WORLD_MIN
  if (population < minimum) continue
  rows.push([`g${id}`, name, iso2, round(Number(lat)), round(Number(lon)), population, regions.get(`${iso2}.${admin1}`) ?? ''])
}

rows.sort((a, b) => b[5] - a[5])
writeFileSync(
  'public/data/gazetteer.json',
  JSON.stringify({ columns: ['id', 'name', 'iso2', 'lat', 'lon', 'population', 'region'], rows }),
)
console.log(`${rows.length} places: ${hungarianCount} in Hungary, ${rows.length - hungarianCount} elsewhere.`)
