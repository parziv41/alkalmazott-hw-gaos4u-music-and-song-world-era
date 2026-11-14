// Builds the data behind the globe for every country and territory in the 1:50m atlas:
//
//   src/data/world.json          bundled: id, ISO code, name, region, camera box, chart source, counts
//   public/data/places/<iso>.json lazy:   cities with the artists born or formed there and the films shot there
//   public/data/cities.json      lazy:    city index for search
//
// Sources: Wikidata (through the QLever SPARQL engine, which answers these queries in seconds where
// query.wikidata.org times out), Shazam's chart directory, Apple Music's chart feeds, and the ISO 3166 table.
//
//   npx tsx scripts/build-world-data.ts               everything (about 15 minutes)
//   npx tsx scripts/build-world-data.ts --only=hu,fr  re-query a few countries, keep the rest from the cache
//   npx tsx scripts/build-world-data.ts --offline     rebuild from scripts/.cache only
//   npx tsx scripts/build-world-data.ts --warm --reverse  in a second terminal: query from the end of the list
import { geoArea, geoBounds, geoCentroid, geoDistance } from 'd3-geo'
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world110 from 'world-atlas/countries-110m.json' with { type: 'json' }
import world50 from 'world-atlas/countries-50m.json' with { type: 'json' }
import curated from '../src/data/countries.json' with { type: 'json' }

const args = process.argv.slice(2)
const offline = args.includes('--offline')
// --warm fills the query cache without writing output (e.g. a second process with --reverse to halve the run).
const warmOnly = args.includes('--warm')
const reverse = args.includes('--reverse')
const only = args.find((arg) => arg.startsWith('--only='))?.slice(7).toLowerCase().split(',')

const CACHE = 'scripts/.cache'
const SPARQL = 'https://qlever.dev/api/wikidata'
const USER_AGENT = 'GlobalMusicMapper-data/1.0 (educational project)'
const ARTISTS_PER_COUNTRY = 400
const FILMS_PER_COUNTRY = 300
mkdirSync(CACHE, { recursive: true })

// ── Small helpers ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function cached<T>(name: string, refresh: boolean, load: () => Promise<T>): Promise<T> {
  const file = join(CACHE, `${name}.json`)
  if (existsSync(file) && (offline || !refresh)) return JSON.parse(readFileSync(file, 'utf8')) as T
  if (offline) throw new Error(`--offline: ${file} is not cached`)
  const value = await load()
  writeFileSync(file, JSON.stringify(value))
  return value
}

async function fetchWithRetry(url: string | URL, init: RequestInit = {}, attempts = 4): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let limited = false
    try {
      const response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers }, signal: AbortSignal.timeout(90_000) })
      if (response.status < 500 && response.status !== 429) return response
      if (attempt >= attempts) return response
      limited = response.status === 429
    } catch (error) {
      if (attempt >= attempts) throw error
    }
    // Rate limits need a real pause; other failures a short one.
    await sleep(limited ? 20_000 * attempt : 1500 * attempt)
  }
}

type Binding = Record<string, { value: string } | undefined>

async function sparql(query: string): Promise<Binding[]> {
  const response = await fetchWithRetry(SPARQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    body: new URLSearchParams({ query }),
  })
  if (!response.ok) throw new Error(`SPARQL ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = (await response.json()) as { results: { bindings: Binding[] } }
  return body.results.bindings
}

const PREFIXES = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`
const qid = (uri?: string) => uri?.split('/').pop() ?? ''
const point = (wkt?: string): [number, number] | null => {
  const match = wkt?.match(/point\(([-\d.eE]+) ([-\d.eE]+)\)/i) // QLever writes POINT(…), WDQS Point(…)
  return match ? [Number(match[1]), Number(match[2])] : null
}
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits

function hashHue(text: string): number {
  let hash = 2166136261
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return Math.abs(hash) % 360
}

// ── Atlas ──────────────────────────────────────────────────────────────────────

type Shape = Feature<Geometry, { name: string }>
const shapes = (topology: unknown) => {
  const t = topology as Topology<{ countries: GeometryCollection<{ name: string }> }>
  return feature(t, t.objects.countries).features as Shape[]
}
const atlasId = (f: Shape) => String(f.id ?? f.properties.name)
const shapes50 = shapes(world50)
const ids110 = new Set(shapes(world110).map(atlasId))

// Areas without an ISO code of their own. Kosovo has one in practice (XK); the rest stay unselectable.
const NAMED_AREAS: Record<string, string> = { Kosovo: 'XK' }
const SKIPPED = new Set(['010']) // Antarctica

// Wikidata often uses a constituent country rather than the ISO item as a place's country.
const EXTRA_QIDS: Record<string, string[]> = { NL: ['Q55'], DK: ['Q756617'], NZ: ['Q664'] }

/** The camera box: the largest landmass plus nearby islands, not far-flung territories. */
function mainlandBox(shape: Shape): { bbox: [number, number, number, number]; center: [number, number] } {
  const geometry = shape.geometry as Polygon | MultiPolygon
  const polygons: Polygon[] =
    geometry.type === 'Polygon' ? [geometry] : geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }))
  const areas = polygons.map((p) => geoArea(p))
  const maxArea = Math.max(...areas)
  const largest = polygons[areas.indexOf(maxArea)]
  const anchor = geoCentroid(largest)
  // Within ~1600 km of the largest landmass and at least 1% of its size.
  const kept = polygons.filter((p, i) => p === largest || (areas[i] > maxArea * 0.01 && geoDistance(anchor, geoCentroid(p)) < 0.25))
  const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: kept.map((p) => p.coordinates) }
  const [[west, south], [east, north]] = geoBounds(multi)
  let centerLon = (west + east) / 2
  if (west > east) centerLon = ((west + east + 360) / 2 + 540) % 360 - 180 // crosses the antimeridian
  return {
    bbox: [round(west, 2), round(south, 2), round(east, 2), round(north, 2)],
    center: [round(centerLon, 2), round((south + north) / 2, 2)],
  }
}

// ── Reference tables ───────────────────────────────────────────────────────────

type IsoRow = { name: string; 'alpha-2': string; 'country-code': string; region: string; 'sub-region': string }
const iso = await cached<IsoRow[]>('iso3166', false, async () => {
  const response = await fetchWithRetry('https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json')
  return (await response.json()) as IsoRow[]
})
const isoByNumeric = new Map(iso.map((row) => [row['country-code'], row]))

const countryItems = await cached('wikidata-countries', false, async () => {
  const rows = await sparql(`${PREFIXES} SELECT ?item ?iso2 WHERE { ?item wdt:P297 ?iso2 }`)
  return rows.map((row) => [row.iso2!.value.toUpperCase(), qid(row.item?.value)] as const)
})
const qidsByIso = new Map<string, string[]>()
for (const [code, item] of countryItems) qidsByIso.set(code, [...(qidsByIso.get(code) ?? []), item])
for (const [code, extra] of Object.entries(EXTRA_QIDS)) qidsByIso.set(code, [...(qidsByIso.get(code) ?? []), ...extra])

type ShazamCity = { id: string; name: string; urlName: string }
type ShazamCountry = { id: string; name: string; urlName: string; cities: ShazamCity[] }
const shazam = await cached<ShazamCountry[]>('shazam-locations', !only, async () => {
  const response = await fetchWithRetry('https://www.shazam.com/services/charts/locations', { headers: { Accept: 'application/json' } })
  const body = (await response.json()) as { countries: ShazamCountry[] }
  return body.countries.map(({ id, name, urlName, cities }) => ({
    id,
    name,
    urlName,
    cities: cities.map((city) => ({ id: city.id, name: city.name, urlName: city.urlName })),
  }))
})
const shazamByIso = new Map(shazam.map((country) => [country.id, country]))

// Shazam city ids are GeoNames ids, which Wikidata links to coordinates.
const shazamCoords = await cached<Record<string, [number, number]>>('shazam-coords-v2', !only, async () => {
  const ids = shazam.flatMap((country) => country.cities.map((city) => `"${city.id}"`))
  const rows = await sparql(`${PREFIXES} SELECT ?gn ?coord WHERE { VALUES ?gn { ${ids.join(' ')} } ?item wdt:P1566 ?gn . ?item wdt:P625 ?coord }`)
  const coords: Record<string, [number, number]> = {}
  for (const row of rows) {
    const p = point(row.coord?.value)
    if (p && row.gn) coords[row.gn.value] ??= p
  }
  return coords
})

// ── Countries ──────────────────────────────────────────────────────────────────

type Base = { id: string; iso2: string; name: string; region: string; shape: Shape }
const curatedById = new Map((curated as unknown as { id: string; hue: number; bbox: [number, number, number, number]; region: string; name: string }[]).map((c) => [c.id, c]))

const bases: Base[] = []
for (const shape of shapes50) {
  const id = atlasId(shape)
  if (SKIPPED.has(id)) continue
  const row = isoByNumeric.get(id)
  const iso2 = row?.['alpha-2'] ?? NAMED_AREAS[id]
  if (!iso2 || bases.some((b) => b.iso2 === iso2)) continue
  bases.push({ id, iso2, name: row?.name ?? shape.properties.name, region: row?.['sub-region'] || row?.region || 'Europe', shape })
}

// Friendlier names than the ISO table's formal ones.
const NAMES: Record<string, string> = {
  GB: 'United Kingdom', US: 'United States', RU: 'Russia', IR: 'Iran', KR: 'South Korea', KP: 'North Korea', SY: 'Syria',
  VE: 'Venezuela', BO: 'Bolivia', TZ: 'Tanzania', VN: 'Vietnam', LA: 'Laos', MD: 'Moldova', CD: 'DR Congo', CG: 'Congo',
  TW: 'Taiwan', FM: 'Micronesia', PS: 'Palestine', BN: 'Brunei', CV: 'Cape Verde', CZ: 'Czechia', TR: 'Turkey', XK: 'Kosovo',
  MK: 'North Macedonia', VA: 'Vatican City', SZ: 'Eswatini', CI: "Côte d'Ivoire", BQ: 'Caribbean Netherlands',
  FK: 'Falkland Islands', VG: 'British Virgin Islands', VI: 'U.S. Virgin Islands', SH: 'Saint Helena', KN: 'St Kitts & Nevis',
  VC: 'St Vincent & the Grenadines', LC: 'Saint Lucia', TT: 'Trinidad & Tobago', BA: 'Bosnia & Herzegovina', AG: 'Antigua & Barbuda',
  ST: 'São Tomé & Príncipe', HM: 'Heard & McDonald Islands', GS: 'South Georgia', IO: 'British Indian Ocean Territory',
  PN: 'Pitcairn Islands', WF: 'Wallis & Futuna', PM: 'St Pierre & Miquelon', TC: 'Turks & Caicos', MF: 'Saint Martin',
  BL: 'Saint Barthélemy', SX: 'Sint Maarten', MO: 'Macao', HK: 'Hong Kong', AX: 'Åland', FO: 'Faroe Islands',
}

// ── Apple Music chart coverage ─────────────────────────────────────────────────

// Probed one storefront at a time (Apple drops parallel requests); progress is cached so a rerun resumes.
const appleFile = join(CACHE, 'apple-storefronts.json')
const appleProbe: Record<string, boolean> = existsSync(appleFile) ? JSON.parse(readFileSync(appleFile, 'utf8')) : {}
if (!offline) {
  let failures = 0
  for (const base of bases) {
    if (base.iso2 in appleProbe) continue
    // Apple throttles after a few hundred requests; stop early and let a later run fill the gaps.
    if (failures >= 4) {
      console.log('Apple Music feed is throttling; the remaining storefronts stay unknown until the next run.')
      break
    }
    const url = `https://rss.marketingtools.apple.com/api/v2/${base.iso2.toLowerCase()}/music/most-played/10/songs.json`
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(12_000) }).catch(() => null)
    if (!response || response.status === 502 || response.status === 503 || response.status === 429) {
      failures++
      await sleep(1500)
      continue
    }
    failures = 0
    appleProbe[base.iso2] = response.ok
    writeFileSync(appleFile, JSON.stringify(appleProbe))
    await sleep(200)
  }
}
const appleStorefronts = Object.keys(appleProbe).filter((code) => appleProbe[code])
console.log(`Apple Music charts: ${appleStorefronts.length} storefronts`)
const apple = new Set(appleStorefronts)

// ── Artists and films per country ──────────────────────────────────────────────

// Singer, musician, composer, rapper, singer-songwriter, DJ, songwriter, guitarist, pianist, film composer,
// record producer, conductor, violinist, drummer.
const OCCUPATIONS = 'Q177220 Q639669 Q36834 Q2252262 Q488205 Q130857 Q753110 Q855091 Q486748 Q1415090 Q183945 Q158852 Q1259917 Q386854'
// Musical group, rock band, musical ensemble, duo, girl group, boy band.
const GROUPS = 'Q215380 Q5741069 Q2088357 Q9212979 Q641066 Q216337'
const wd = (ids: string) => ids.split(' ').map((id) => `wd:${id}`).join(' ')

const labels = (subject: string, name: string) => `
  OPTIONAL { ${subject} rdfs:label ?${name}En . FILTER(LANG(?${name}En) = "en") }
  OPTIONAL { ${subject} rdfs:label ?${name}Mul . FILTER(LANG(?${name}Mul) = "mul") }`

const musicQuery = (countries: string[]) => `${PREFIXES}
SELECT ?artist ?kind ?place ?sl ?coord ?pop ?date ?genre ?img ?deezer ?artistEn ?artistMul ?placeEn ?placeMul WHERE {
  {
    SELECT ?artist ?kind ?place (MAX(?s) AS ?sl) WHERE {
      VALUES ?country { ${countries.map((c) => `wd:${c}`).join(' ')} }
      {
        VALUES ?occ { ${wd(OCCUPATIONS)} }
        ?artist wdt:P106 ?occ . ?artist wdt:P19 ?place . BIND("p" AS ?kind)
      } UNION {
        VALUES ?group { ${wd(GROUPS)} }
        ?artist wdt:P31 ?group . ?artist wdt:P740 ?place . BIND("g" AS ?kind)
      }
      ?place wdt:P17 ?country .
      ?artist wikibase:sitelinks ?s .
    } GROUP BY ?artist ?kind ?place ORDER BY DESC(?sl) LIMIT ${ARTISTS_PER_COUNTRY}
  }
  ?place wdt:P625 ?coord .
  ${labels('?artist', 'artist')}
  ${labels('?place', 'place')}
  OPTIONAL { ?place wdt:P1082 ?pop }
  OPTIONAL { ?artist wdt:P569|wdt:P571 ?date }
  OPTIONAL { ?artist wdt:P136 ?g . ?g rdfs:label ?genre . FILTER(LANG(?genre) = "en") }
  OPTIONAL { ?artist wdt:P18 ?img }
  OPTIONAL { ?artist wdt:P2722 ?deezer }
}`

const filmQuery = (countries: string[]) => `${PREFIXES}
SELECT ?film ?place ?sl ?coord ?pop ?date ?director ?filmEn ?filmMul ?placeEn ?placeMul WHERE {
  {
    SELECT ?film ?place (MAX(?s) AS ?sl) WHERE {
      VALUES ?country { ${countries.map((c) => `wd:${c}`).join(' ')} }
      ?film wdt:P31 wd:Q11424 . ?film wdt:P915 ?place . ?place wdt:P17 ?country .
      ?film wikibase:sitelinks ?s .
    } GROUP BY ?film ?place ORDER BY DESC(?sl) LIMIT ${FILMS_PER_COUNTRY}
  }
  ?place wdt:P625 ?coord .
  ${labels('?film', 'film')}
  ${labels('?place', 'place')}
  OPTIONAL { ?place wdt:P1082 ?pop }
  OPTIONAL { ?film wdt:P577 ?date }
  OPTIONAL { ?film wdt:P57 ?d . ?d rdfs:label ?director . FILTER(LANG(?director) = "en") }
}`

export type Artist = {
  id: string
  name: string
  kind: 'p' | 'g'
  year?: number
  genres?: string[]
  image?: string
  /** Deezer artist id from Wikidata, so "play" finds the right Omega among several. */
  deezer?: number
  sl: number
}
export type Film = {
  id: string
  name: string
  year?: number
  director?: string
  /** Poster thumbnail: the lead image of the film's English Wikipedia article. */
  poster?: string
  /** IMDb title id (tt…). */
  imdb?: string
  sl: number
}
export type City = {
  id: string
  name: string
  lat: number
  lon: number
  /** Shazam city chart slug, when Shazam publishes one for this city. */
  chart?: string
  artists: Artist[]
  films: Film[]
}

type Place = { id: string; name: string; coord: [number, number]; pop: number }
type Item<T> = { place: Place; item: T }

function readPlace(row: Binding): Place | null {
  const coord = point(row.coord?.value)
  const name = row.placeEn?.value ?? row.placeMul?.value
  if (!coord || !name) return null
  return { id: qid(row.place?.value), name, coord, pop: Number(row.pop?.value) || 0 }
}

const yearOf = (value?: string) => {
  const year = value ? Number.parseInt(value.replace(/^\+/, '').slice(0, value.startsWith('-') ? 5 : 4), 10) : Number.NaN
  return Number.isFinite(year) && year > 0 && year < 2100 ? year : undefined
}

/** Rows are one per (item, place, optional value) combination; fold them into one record per item and place. */
function fold<T extends { id: string }>(rows: Binding[], key: string, make: (row: Binding) => T | null, merge: (target: T, row: Binding) => void) {
  const items = new Map<string, Item<T>>()
  for (const row of rows) {
    const place = readPlace(row)
    if (!place) continue
    const id = `${qid(row[key]?.value)}|${place.id}`
    const existing = items.get(id)
    if (existing) {
      merge(existing.item, row)
      existing.place.pop = Math.max(existing.place.pop, place.pop)
      continue
    }
    const item = make(row)
    if (!item) continue
    merge(item, row)
    items.set(id, { place, item })
  }
  return [...items.values()]
}

function readArtists(rows: Binding[]): Item<Artist>[] {
  return fold<Artist>(
    rows,
    'artist',
    (row) => {
      const name = row.artistEn?.value ?? row.artistMul?.value
      if (!name) return null
      return { id: qid(row.artist?.value), name, kind: row.kind?.value === 'g' ? 'g' : 'p', sl: Number(row.sl?.value) || 0 }
    },
    (artist, row) => {
      artist.year ??= yearOf(row.date?.value)
      const genre = row.genre?.value
      // Music genres only: Wikidata files some singers' film work under their genres too.
      const musical = genre && !/porn|film|television/i.test(genre)
      if (musical && !artist.genres?.includes(genre) && (artist.genres?.length ?? 0) < 2) artist.genres = [...(artist.genres ?? []), genre]
      const image = row.img?.value
      if (image && !artist.image) artist.image = decodeURIComponent(image.split('/').pop() ?? '')
      const deezer = Number(row.deezer?.value)
      if (Number.isSafeInteger(deezer) && deezer > 0) artist.deezer ??= deezer
    },
  )
}

function readFilms(rows: Binding[]): Item<Film>[] {
  return fold<Film>(
    rows,
    'film',
    (row) => {
      const name = row.filmEn?.value ?? row.filmMul?.value
      if (!name) return null
      const id = qid(row.film?.value)
      return {
        id,
        name,
        ...(posters[id] ? { poster: posters[id] } : {}),
        ...(imdbIds[id] ? { imdb: imdbIds[id] } : {}),
        sl: Number(row.sl?.value) || 0,
      }
    },
    (film, row) => {
      const year = yearOf(row.date?.value)
      if (year && (!film.year || year < film.year)) film.year = year
      film.director ??= row.director?.value
    },
  )
}

// Metro areas count as settlements in Wikidata but would swallow their city ("Greater Buenos Aires").
const REGION = /\b(province|region|county|oblast|governorate|prefecture|state|department|voivodeship|canton|krai|okrug|metropolitan|greater)\b/i
/**
 * Towns and cities anchor clusters; regions, studios and landmarks join the nearest one. Wikidata's
 * class tree misses some cities (Madrid, Marseille), so a populated place of city size counts too.
 */
const isAnchor = (place: { id: string; name: string; pop: number }) => {
  if (REGION.test(place.name) && !/\bcity\b/i.test(place.name)) return false
  if (settlements.has(place.id)) return true
  const area = areas[place.id] ?? 0
  return place.pop > 0 && area > 0 && area < 3000
}

/** Haversine distance in km. */
function km([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  return geoDistance([lon1, lat1], [lon2, lat2]) * 6371
}

// Shazam's local city names, in the English that Wikidata labels use.
const SHAZAM_ALIASES: Record<string, string> = {
  koln: 'cologne',
  hannover: 'hanover',
  sevilla: 'seville',
  goteborg: 'gothenburg',
  'frankfurt am main': 'frankfurt',
  munchen: 'munich',
  quebec: 'quebec city',
  lisboa: 'lisbon',
  roma: 'rome',
  milano: 'milan',
  napoli: 'naples',
  torino: 'turin',
  warszawa: 'warsaw',
  praha: 'prague',
  wien: 'vienna',
}

/**
 * Groups birthplaces and filming locations into cities: districts, stations and landmarks join the
 * most populous place nearby (Pest and Buda become Budapest, Fisherman's Bastion joins it too).
 */
function clusterCities(artists: Item<Artist>[], films: Item<Film>[], skip: Set<string>, chartCities: ShazamCity[]): City[] {
  const places = new Map<string, Place & { count: number }>()
  for (const { place } of [...artists, ...films]) {
    if (skip.has(place.id)) continue
    const existing = places.get(place.id)
    if (existing) existing.count++
    else places.set(place.id, { ...place, count: 1 })
  }
  // Towns and cities anchor first; provinces, studios and landmarks stand alone only when no town is near.
  const ordered = [...places.values()].sort(
    (a, b) => Number(isAnchor(b)) - Number(isAnchor(a)) || b.pop - a.pop || b.count - a.count,
  )
  type Cluster = { city: City; coord: [number, number]; radius: number; artistIds: Set<string>; filmIds: Set<string> }
  const clusters: Cluster[] = []
  const clusterOf = new Map<string, Cluster>()
  for (const place of ordered) {
    const radius = place.pop > 0 && isAnchor(place) ? Math.min(25, Math.max(8, 8 + 6 * Math.log10(place.pop / 1e5))) : 8
    const near = clusters.find((cluster) => km(cluster.coord, place.coord) < cluster.radius)
    if (near) {
      clusterOf.set(place.id, near)
      continue
    }
    const cluster: Cluster = {
      city: { id: place.id, name: place.name, lon: round(place.coord[0]), lat: round(place.coord[1]), artists: [], films: [] },
      coord: place.coord,
      radius,
      artistIds: new Set(),
      filmIds: new Set(),
    }
    clusters.push(cluster)
    clusterOf.set(place.id, cluster)
  }

  for (const { place, item } of artists) {
    const cluster = clusterOf.get(place.id)
    if (cluster && !cluster.artistIds.has(item.id)) {
      cluster.artistIds.add(item.id)
      cluster.city.artists.push(item)
    }
  }
  for (const { place, item } of films) {
    const cluster = clusterOf.get(place.id)
    if (cluster && !cluster.filmIds.has(item.id)) {
      cluster.filmIds.add(item.id)
      cluster.city.films.push(item)
    }
  }

  // Shazam's city charts join the city of the same name (its GeoNames ids aren't always right:
  // "Marseille" points at Toulon), or become a city of their own rather than borrow a neighbour's name.
  const plain = (text: string) => {
    const folded = text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    return SHAZAM_ALIASES[folded] ?? folded
  }
  for (const chartCity of chartCities) {
    const coord = shazamCoords[chartCity.id]
    const wanted = plain(chartCity.name)
    const named = clusters.find(({ city, coord: at }) => {
      const name = plain(city.name)
      return (name === wanted || name.startsWith(`${wanted} `)) && (!coord || km(at, coord) < 80)
    })
    if (named && !named.city.chart) {
      named.city.chart = chartCity.urlName
      continue
    }
    if (!coord) continue
    clusters.push({
      city: { id: `gn${chartCity.id}`, name: chartCity.name, lon: round(coord[0]), lat: round(coord[1]), chart: chartCity.urlName, artists: [], films: [] },
      coord,
      radius: 0,
      artistIds: new Set(),
      filmIds: new Set(),
    })
  }

  for (const { city } of clusters) {
    city.artists.sort((a, b) => b.sl - a.sl)
    city.films.sort((a, b) => b.sl - a.sl)
  }
  return clusters
    .map(({ city }) => city)
    .filter((city) => city.artists.length || city.films.length || city.chart)
    .sort((a, b) => b.artists.length + b.films.length - (a.artists.length + a.films.length) || (b.chart ? 1 : 0) - (a.chart ? 1 : 0))
}

// ── Settlements ────────────────────────────────────────────────────────────────

/**
 * Which birthplaces and filming locations are towns and cities (Wikidata: any subclass of "human
 * settlement"), as opposed to regions, studios and landmarks. Only settlements anchor a city.
 */
async function loadSettlements(placeIds: string[]): Promise<Set<string>> {
  const file = join(CACHE, 'place-settlements.json')
  const known: Record<string, boolean> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const missing = placeIds.filter((id) => !(id in known))
  for (let i = 0; !offline && i < missing.length; i += 1500) {
    const batch = missing.slice(i, i + 1500)
    const rows = await sparql(`${PREFIXES}
SELECT DISTINCT ?place WHERE {
  VALUES ?place { ${batch.map((id) => `wd:${id}`).join(' ')} }
  ?place wdt:P31/wdt:P279* wd:Q486972 .
}`)
    for (const id of batch) known[id] = false
    for (const row of rows) known[qid(row.place?.value)] = true
    writeFileSync(file, JSON.stringify(known))
    console.log(`Settlements: ${Math.min(i + 1500, missing.length)} / ${missing.length}`)
    await sleep(1500)
  }
  return new Set(Object.keys(known).filter((id) => known[id]))
}

/** Land area in km² (0 when unknown), for places Wikidata doesn't file under settlements. */
async function loadAreas(placeIds: string[]): Promise<Record<string, number>> {
  const file = join(CACHE, 'place-areas.json')
  const areas: Record<string, number> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const missing = placeIds.filter((id) => !(id in areas))
  for (let i = 0; !offline && i < missing.length; i += 1500) {
    const batch = missing.slice(i, i + 1500)
    const rows = await sparql(`${PREFIXES}
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psn: <http://www.wikidata.org/prop/statement/value-normalized/>
SELECT ?place (MAX(?amount) AS ?m2) WHERE {
  VALUES ?place { ${batch.map((id) => `wd:${id}`).join(' ')} }
  ?place p:P2046 ?statement . ?statement psn:P2046 ?value . ?value wikibase:quantityAmount ?amount .
} GROUP BY ?place`)
    for (const id of batch) areas[id] = 0
    for (const row of rows) areas[qid(row.place?.value)] = Math.round(Number(row.m2?.value) / 1e6)
    writeFileSync(file, JSON.stringify(areas))
    console.log(`Areas: ${Math.min(i + 1500, missing.length)} / ${missing.length}`)
    await sleep(1500)
  }
  return areas
}

// ── Film posters ───────────────────────────────────────────────────────────────

/**
 * Posters from the lead image of each film's English Wikipedia article, which for films is nearly
 * always the poster. Wikidata gives the article titles; Wikipedia's PageImages API, 50 at a time,
 * the thumbnails. Cached per film, so reruns only look up films they haven't seen.
 */
async function loadPosters(filmIds: string[]): Promise<Record<string, string>> {
  const titlesFile = join(CACHE, 'film-titles.json')
  const postersFile = join(CACHE, 'film-posters.json')
  const titles: Record<string, string> = existsSync(titlesFile) ? JSON.parse(readFileSync(titlesFile, 'utf8')) : {}
  const posters: Record<string, string> = existsSync(postersFile) ? JSON.parse(readFileSync(postersFile, 'utf8')) : {}
  if (offline) return posters

  const untitled = filmIds.filter((id) => !(id in titles))
  for (let i = 0; i < untitled.length; i += 1500) {
    const batch = untitled.slice(i, i + 1500)
    const rows = await sparql(`${PREFIXES}
PREFIX schema: <http://schema.org/>
SELECT ?film ?title WHERE {
  VALUES ?film { ${batch.map((id) => `wd:${id}`).join(' ')} }
  ?article schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
}`)
    for (const id of batch) titles[id] = ''
    for (const row of rows) titles[qid(row.film?.value)] = row.title?.value ?? ''
    writeFileSync(titlesFile, JSON.stringify(titles))
    console.log(`Film articles: ${Math.min(i + 1500, untitled.length)} / ${untitled.length}`)
    await sleep(1500)
  }

  const missing = filmIds.filter((id) => titles[id] && !(id in posters))
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50)
    const url = new URL('https://en.wikipedia.org/w/api.php')
    for (const [key, value] of Object.entries({
      action: 'query',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '200',
      pilicense: 'any', // film posters are non-free images, used on Wikipedia under fair use
      redirects: '1',
      format: 'json',
      formatversion: '2',
      maxlag: '5',
      titles: batch.map((id) => titles[id]).join('|'),
    }))
      url.searchParams.set(key, value)
    const response = await fetchWithRetry(url)
    if (!response.ok) throw new Error(`Wikipedia ${response.status}`)
    type Renamed = { from: string; to: string }
    const body = (await response.json()) as {
      query?: { normalized?: Renamed[]; redirects?: Renamed[]; pages?: { title: string; thumbnail?: { source: string } }[] }
    }
    // Follow the API's title normalisations and redirects back to the titles we asked for.
    const rename = new Map([...(body.query?.normalized ?? []), ...(body.query?.redirects ?? [])].map(({ from, to }) => [from, to]))
    const final = (title: string) => {
      let current = title
      for (let hops = 0; hops < 3 && rename.has(current); hops++) current = rename.get(current)!
      return current
    }
    const thumbnails = new Map((body.query?.pages ?? []).map((page) => [page.title, page.thumbnail?.source.split('?')[0] ?? '']))
    for (const id of batch) posters[id] = thumbnails.get(final(titles[id])) ?? ''
    writeFileSync(postersFile, JSON.stringify(posters))
    if ((i / 50) % 10 === 0) console.log(`Posters: ${Math.min(i + 50, missing.length)} / ${missing.length}`)
    await sleep(250)
  }
  return posters
}

const allFilmIds = new Set<string>()
for (const base of bases) {
  const file = join(CACHE, `films-${base.iso2}.json`)
  if (!existsSync(file)) continue
  for (const row of JSON.parse(readFileSync(file, 'utf8')) as Binding[]) allFilmIds.add(qid(row.film?.value))
}
const posters = await loadPosters([...allFilmIds].filter(Boolean).sort())

/** IMDb ids (Wikidata P345), so every film can link to its IMDb page. */
async function loadImdbIds(filmIds: string[]): Promise<Record<string, string>> {
  const file = join(CACHE, 'film-imdb.json')
  const ids: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const missing = filmIds.filter((id) => !(id in ids))
  for (let i = 0; !offline && i < missing.length; i += 1500) {
    const batch = missing.slice(i, i + 1500)
    const rows = await sparql(`${PREFIXES}
SELECT ?film (MIN(?imdb) AS ?id) WHERE {
  VALUES ?film { ${batch.map((id) => `wd:${id}`).join(' ')} }
  ?film wdt:P345 ?imdb . FILTER(STRSTARTS(?imdb, "tt"))
} GROUP BY ?film`)
    for (const id of batch) ids[id] = ''
    for (const row of rows) ids[qid(row.film?.value)] = row.id?.value ?? ''
    writeFileSync(file, JSON.stringify(ids))
    console.log(`IMDb ids: ${Math.min(i + 1500, missing.length)} / ${missing.length}`)
    await sleep(1500)
  }
  return ids
}
const imdbIds = await loadImdbIds([...allFilmIds].filter(Boolean).sort())

const allPlaceIds = new Set<string>()
for (const base of bases) {
  for (const kind of ['music', 'films']) {
    const file = join(CACHE, `${kind}-${base.iso2}.json`)
    if (!existsSync(file)) continue
    for (const row of JSON.parse(readFileSync(file, 'utf8')) as Binding[]) allPlaceIds.add(qid(row.place?.value))
  }
}
const settlements = await loadSettlements([...allPlaceIds].filter(Boolean).sort())
const areas = await loadAreas([...allPlaceIds].filter((id) => id && !settlements.has(id)).sort())

// ── Build ──────────────────────────────────────────────────────────────────────

// Files are overwritten in place and stale ones removed at the end: deleting the folder while
// `vite dev` runs makes it serve index.html for these paths until restarted.
const placesDir = 'public/data/places'
mkdirSync(placesDir, { recursive: true })
const written = new Set<string>()

type WorldCountry = {
  id: string
  iso2: string
  name: string
  region: string
  hue: number
  bbox: [number, number, number, number]
  center: [number, number]
  small?: true
  chart?: 'apple' | 'shazam'
  shazam?: string
  cities: number
  artists: number
  films: number
}
/** `chart` is the city's Shazam slug, so search and chart comparison can ask for its chart directly. */
type SearchCity = { id: string; name: string; iso2: string; lat: number; lon: number; artists: number; films: number; chart?: string }

// ── Timeline: what was made where, decade by decade ────────────────────────────

/** The time machine's stops: everything before 1850 together, then each decade to the 2020s. */
const DECADES = [1840, ...Array.from({ length: 18 }, (_, i) => 1850 + i * 10)]
const decadeIndex = (year: number) => (year < 1850 ? 0 : Math.min(DECADES.length - 1, Math.floor((year - 1850) / 10) + 1))
type Counts = { a: number[]; f: number[] }
const timelineCountries: Record<string, Counts> = {}
// Sums of unit vectors, for each decade's geographic centre of gravity of artists and of films.
const gravity = { a: DECADES.map(() => [0, 0, 0, 0]), f: DECADES.map(() => [0, 0, 0, 0]) }

function addToTimeline(iso2: string, cities: City[]) {
  const counts: Counts = { a: DECADES.map(() => 0), f: DECADES.map(() => 0) }
  const count = (kind: 'a' | 'f', year: number | undefined, city: City) => {
    if (!year) return
    const index = decadeIndex(year)
    counts[kind][index]++
    const lon = (city.lon * Math.PI) / 180
    const lat = (city.lat * Math.PI) / 180
    const sum = gravity[kind][index]
    sum[0] += Math.cos(lat) * Math.cos(lon)
    sum[1] += Math.cos(lat) * Math.sin(lon)
    sum[2] += Math.sin(lat)
    sum[3]++
  }
  for (const city of cities) {
    for (const artist of city.artists) count('a', artist.year, city)
    for (const film of city.films) count('f', film.year, city)
  }
  if (counts.a.some(Boolean) || counts.f.some(Boolean)) timelineCountries[base2iso(iso2)] = counts
}
const base2iso = (iso2: string) => iso2.toUpperCase()

/** Back from a sum of unit vectors to [lon, lat, how many]. */
const centreOf = ([x, y, z, n]: number[]): [number, number, number] | null =>
  n ? [round((Math.atan2(y, x) * 180) / Math.PI, 2), round((Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI, 2), n] : null

const output: WorldCountry[] = []
const searchCities: SearchCity[] = []
let index = 0
const ordered = bases.sort((a, b) => a.name.localeCompare(b.name))
for (const base of reverse ? ordered.toReversed() : ordered) {
  index++
  const items = qidsByIso.get(base.iso2) ?? []
  const refresh = !!only?.includes(base.iso2.toLowerCase())
  let artists: Item<Artist>[] = []
  let films: Item<Film>[] = []
  if (items.length) {
    try {
      const musicRows = await cached(`music-${base.iso2}`, refresh, () => sparql(musicQuery(items)))
      const filmRows = await cached(`films-${base.iso2}`, refresh, () => sparql(filmQuery(items)))
      artists = readArtists(musicRows)
      films = readFilms(filmRows)
    } catch (error) {
      console.warn(`  ! ${base.name}: ${error}`)
    }
  }
  if (warmOnly) {
    console.log(`${String(index).padStart(3)} ${base.name}: cached`)
    continue
  }
  const shazamCountry = shazamByIso.get(base.iso2)
  const cities = clusterCities(artists, films, new Set(items), shazamCountry?.cities ?? [])
  const totalArtists = new Set(cities.flatMap((city) => city.artists.map((a) => a.id))).size
  const totalFilms = new Set(cities.flatMap((city) => city.films.map((f) => f.id))).size

  const chart = apple.has(base.iso2) ? 'apple' : shazamCountry ? 'shazam' : undefined
  if (!chart && !cities.length) {
    console.log(`${String(index).padStart(3)} ${base.name}: no data, left unselectable`)
    continue
  }

  const curatedEntry = curatedById.get(base.id)
  const { bbox, center } = mainlandBox(base.shape)
  const box = curatedEntry?.bbox ?? bbox
  output.push({
    id: base.id,
    iso2: base.iso2,
    name: curatedEntry?.name ?? NAMES[base.iso2] ?? base.name,
    region: curatedEntry?.region ?? base.region,
    hue: curatedEntry?.hue ?? hashHue(base.iso2),
    bbox: box,
    center: curatedEntry ? [round((box[0] + box[2]) / 2, 2), round((box[1] + box[3]) / 2, 2)] : center,
    ...(ids110.has(base.id) ? {} : { small: true as const }),
    ...(chart ? { chart } : {}),
    ...(shazamCountry ? { shazam: shazamCountry.urlName } : {}),
    cities: cities.length,
    artists: totalArtists,
    films: totalFilms,
  })
  if (cities.length) {
    const file = `${base.iso2.toLowerCase()}.json`
    writeFileSync(join(placesDir, file), JSON.stringify({ iso2: base.iso2, cities }))
    written.add(file)
  }
  addToTimeline(base.iso2, cities)
  for (const city of cities.slice(0, 25)) {
    searchCities.push({
      id: city.id,
      name: city.name,
      iso2: base.iso2,
      lat: city.lat,
      lon: city.lon,
      artists: city.artists.length,
      films: city.films.length,
      ...(city.chart ? { chart: city.chart } : {}),
    })
  }
  console.log(
    `${String(index).padStart(3)} ${base.name}: ${totalArtists} artists, ${totalFilms} films, ${cities.length} cities${chart ? `, ${chart} chart` : ''}`,
  )
}

if (warmOnly) process.exit(0)
writeFileSync('src/data/world.json', `${JSON.stringify(output, null, 0).replaceAll('},{', '},\n{')}\n`)
writeFileSync('public/data/cities.json', JSON.stringify(searchCities))
writeFileSync(
  'public/data/timeline.json',
  JSON.stringify({ decades: DECADES, countries: timelineCountries, centers: { a: gravity.a.map(centreOf), f: gravity.f.map(centreOf) } }),
)
for (const file of readdirSync(placesDir)) if (!written.has(file)) rmSync(join(placesDir, file))
console.log(`\n${output.length} countries, ${searchCities.length} searchable cities.`)
