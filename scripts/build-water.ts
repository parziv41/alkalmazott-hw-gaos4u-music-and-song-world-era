// Builds public/data/water.json: rivers and lakes for the globe.
//
//   Europe     Natural Earth 1:10m rivers and lakes plus its European supplement (smaller rivers
//              such as the Zagyva or Hernád, and lakes such as Tisza-tó and Fertő)
//   elsewhere  Natural Earth 1:50m: the major rivers and lakes
//   Hungary    rivers and lakes Natural Earth lacks (Velencei-tó, Bodrog, Szamos…), from
//              OpenStreetMap, when scripts/.cache/osm/hu-extra.json has been fetched
//
//   npx tsx scripts/build-water.ts
//
// Each feature keeps the zoom from which it is drawn, so the globe shows the Volga from afar and
// the Zala only close up. Natural Earth is public domain; OpenStreetMap data is © OpenStreetMap
// contributors (ODbL).
import { geoArea, geoCentroid, geoDistance, type GeoPermissibleObjects } from 'd3-geo'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CACHE = 'scripts/.cache/naturalearth'
const OSM_EXTRA = 'scripts/.cache/osm/hu-extra.json'
const USER_AGENT = 'GlobalMusicMapper-data/1.0 (educational project)'
const EUROPE = { west: -25, south: 34, east: 50, north: 72 }
const CHUNK = 80 // points per river piece, so the globe can skip pieces that are off screen
mkdirSync(CACHE, { recursive: true })

type Position = [number, number]
type Geometry =
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }
type Feature = { properties: Record<string, string | number | null>; geometry: Geometry | null }

async function load(name: string): Promise<Feature[]> {
  const file = join(CACHE, `${name}.geojson`)
  if (!existsSync(file)) {
    const response = await fetch(`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${name}.geojson`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!response.ok) throw new Error(`Natural Earth ${name}: ${response.status}`)
    writeFileSync(file, await response.text())
  }
  return (JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] }).features
}

const lines = (geometry: Geometry): Position[][] =>
  geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : []
const polygons = (geometry: Geometry): Position[][][] =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
const inEurope = ([lon, lat]: Position) => lon >= EUROPE.west && lon <= EUROPE.east && lat >= EUROPE.south && lat <= EUROPE.north
const touchesEurope = (geometry: Geometry) => [...lines(geometry), ...polygons(geometry).flat()].some((line) => line.some(inEurope))

/** Douglas–Peucker: drops points that change the line by less than `tolerance` degrees. */
function simplify(points: Position[], tolerance: number): Position[] {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    const [x1, y1] = points[first]
    const [x2, y2] = points[last]
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy)
    let worst = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      // A closed ring starts and ends on the same point: measure from that point instead of a line.
      const distance =
        length < 1e-12
          ? Math.hypot(points[i][0] - x1, points[i][1] - y1)
          : Math.abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / length
      if (distance > worst) {
        worst = distance
        index = i
      }
    }
    if (index !== -1 && worst > tolerance) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

/**
 * Coordinates in thousandths of a degree (about 100 m), each point stored as the step from the
 * previous one: "19040,47498,3,-2,…" instead of "19.04,47.498,19.043,47.496,…" halves the file.
 */
function flat(points: Position[]): number[] {
  const out: number[] = []
  let lastX = 0
  let lastY = 0
  for (const [lon, lat] of points) {
    const x = Math.round(lon * 1000)
    const y = Math.round(lat * 1000)
    if (out.length && x === lastX && y === lastY) continue
    out.push(x - lastX, y - lastY)
    lastX = x
    lastY = y
  }
  return out
}

/** Natural Earth's web-map zoom → the globe's zoom factor (zoom 1 ≈ web zoom 3.3). */
const zoomFactor = (minZoom: number) => Math.round(Math.min(40, Math.max(1, 2 ** (minZoom - 3.3))) * 10) / 10

// Hungarian names for rivers whose Natural Earth entry has none.
const HUNGARIAN: Record<string, string> = {
  Danube: 'Duna',
  Donau: 'Duna',
  Tisa: 'Tisza',
  Tisza: 'Tisza',
  Drau: 'Dráva',
  Drava: 'Dráva',
  Mur: 'Mura',
  Mures: 'Maros',
  Sava: 'Száva',
  Sio: 'Sió',
  'Soroksari Duna': 'Ráckevei-Duna',
  'Ferenc Csatorna': 'Ferenc-csatorna',
  Morava: 'Morva',
}
// Natural Earth sometimes uses a local spelling as the English name.
const ENGLISH: Record<string, string> = { Tisa: 'Tisza', Donau: 'Danube', Drau: 'Drava', Mures: 'Mureș', Sio: 'Sió', 'Soroksari Duna': 'Ráckeve Danube' }

/** Centre and angular radius (in thousandths of a radian) for culling, computed here so the browser needn't. */
type Circle = [lon: number, lat: number, radius: number]
/** [name, Hungarian name or '', zoom factor, bounding circle, delta-encoded lon/lat list (see `flat`)] */
type River = [string, string, number, Circle, number[]]
/** [name, Hungarian name or '', zoom factor, bounding circle, rings as delta-encoded lon/lat lists] */
type Lake = [string, string, number, Circle, number[][]]

function circle(object: GeoPermissibleObjects, points: Position[]): Circle {
  const center = geoCentroid(object)
  let radius = 0
  for (const point of points) radius = Math.max(radius, geoDistance(center, point))
  return [Math.round(center[0] * 1000) / 1000, Math.round(center[1] * 1000) / 1000, Math.ceil(radius * 1000)]
}
const rivers: River[] = []
const lakes: Lake[] = []

function names(properties: Feature['properties'], kind: 'river' | 'lake'): [string, string] {
  // Lakes' English names drop the "Lake" ("Geneva"); their main name keeps it ("Lake Geneva").
  const raw = String((kind === 'lake' ? properties.name || properties.name_en : properties.name_en || properties.name) || '').trim()
  const name = ENGLISH[raw] ?? raw
  const hu = String(properties.name_hu || HUNGARIAN[raw] || '').trim()
  return [name, hu && hu !== name ? hu : '']
}

function addRiver(feature: Feature, tolerance: number) {
  if (!feature.geometry || !String(feature.properties.featurecla).includes('River')) return // skips lines drawn across lakes
  const [name, hu] = names(feature.properties, 'river')
  const k = zoomFactor(Number(feature.properties.min_zoom) || 7)
  for (const line of lines(feature.geometry)) {
    const points = simplify(line, tolerance)
    for (let start = 0; start < points.length - 1; start += CHUNK - 1) {
      const piece = points.slice(start, start + CHUNK)
      rivers.push([name, hu, k, circle({ type: 'LineString', coordinates: piece }, piece), flat(piece)])
    }
  }
}

/**
 * d3 reads a ring's direction: wound one way it is the lake, the other way everything but the lake.
 * Data in the GeoJSON convention comes out as the latter, so flip any polygon larger than a hemisphere.
 */
function d3Winding(rings: Position[][]): Position[][] {
  return geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((ring) => ring.toReversed()) : rings
}

function addLake(feature: Feature, tolerance: number) {
  if (!feature.geometry || !/Lake|Reservoir/.test(String(feature.properties.featurecla))) return
  const [name, hu] = names(feature.properties, 'lake')
  const k = zoomFactor(Number(feature.properties.min_zoom) || 7)
  for (const polygon of polygons(feature.geometry)) {
    const rings = polygon.map((ring) => simplify(ring, tolerance)).filter((ring) => ring.length >= 4)
    if (rings.length) {
      const wound = d3Winding(rings)
      lakes.push([name, hu, k, circle({ type: 'Polygon', coordinates: wound }, wound[0]), wound.map(flat)])
    }
  }
}

// ── Natural Earth ──────────────────────────────────────────────────────────────

for (const feature of [...(await load('ne_10m_rivers_lake_centerlines')), ...(await load('ne_10m_rivers_europe'))]) {
  if (feature.geometry && touchesEurope(feature.geometry)) addRiver(feature, 0.004)
}
for (const feature of await load('ne_50m_rivers_lake_centerlines')) {
  if (feature.geometry && !touchesEurope(feature.geometry)) addRiver(feature, 0.01)
}
for (const feature of [...(await load('ne_10m_lakes')), ...(await load('ne_10m_lakes_europe'))]) {
  if (feature.geometry && touchesEurope(feature.geometry)) addLake(feature, 0.003)
}
for (const feature of await load('ne_50m_lakes')) {
  if (feature.geometry && !touchesEurope(feature.geometry)) addLake(feature, 0.01)
}
const fromNaturalEarth = { rivers: rivers.length, lakes: lakes.length }

// ── OpenStreetMap: Hungarian waters Natural Earth lacks ────────────────────────

type OsmPoint = { lat: number; lon: number }
type OsmElement = {
  type: 'way' | 'relation'
  tags?: Record<string, string>
  geometry?: OsmPoint[]
  members?: { type: string; role: string; geometry?: OsmPoint[] }[]
}

/** Joins a multipolygon's outer ways end to end into closed rings. */
function stitch(ways: Position[][]): Position[][] {
  const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1]
  const rest = ways.filter((way) => way.length > 1)
  const rings: Position[][] = []
  while (rest.length) {
    const ring = [...rest.shift()!]
    let grew = true
    while (grew && !same(ring[0], ring.at(-1)!)) {
      grew = false
      for (let i = 0; i < rest.length; i++) {
        const way = rest[i]
        if (same(ring.at(-1)!, way[0])) ring.push(...way.slice(1))
        else if (same(ring.at(-1)!, way.at(-1)!)) ring.push(...way.toReversed().slice(1))
        else continue
        rest.splice(i, 1)
        grew = true
        break
      }
    }
    if (ring.length >= 4) rings.push(ring)
  }
  return rings
}

let fromOsm = 0
if (existsSync(OSM_EXTRA)) {
  const toPositions = (points: OsmPoint[]) => points.map(({ lon, lat }): Position => [lon, lat])
  for (const element of (JSON.parse(readFileSync(OSM_EXTRA, 'utf8')) as { elements: OsmElement[] }).elements) {
    const hu = element.tags?.name ?? ''
    const name = element.tags?.['name:en'] ?? hu
    if (element.tags?.waterway === 'river' && element.geometry) {
      const points = simplify(toPositions(element.geometry), 0.002)
      for (let start = 0; start < points.length - 1; start += CHUNK - 1) {
        const piece = points.slice(start, start + CHUNK)
        rivers.push([name, hu === name ? '' : hu, 7, circle({ type: 'LineString', coordinates: piece }, piece), flat(piece)])
      }
      fromOsm++
    } else if (element.tags?.natural === 'water') {
      const outer =
        element.type === 'way' && element.geometry
          ? [toPositions(element.geometry)]
          : stitch((element.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => toPositions(m.geometry!)))
      const rings = outer.map((ring) => simplify(ring, 0.001)).filter((ring) => ring.length >= 4)
      if (rings.length) {
        // Each outer ring is its own lake here (inner rings, islands in the reeds, are left out).
        for (const ring of rings) {
          const wound = d3Winding([ring])
          lakes.push([name, hu === name ? '' : hu, 4, circle({ type: 'Polygon', coordinates: wound }, wound[0]), wound.map(flat)])
        }
        fromOsm++
      }
    }
  }
}

writeFileSync('public/data/water.json', JSON.stringify({ rivers, lakes }))
console.log(
  `${rivers.length} river pieces and ${lakes.length} lakes (Natural Earth: ${fromNaturalEarth.rivers} + ${fromNaturalEarth.lakes}; OpenStreetMap: ${fromOsm} features).`,
)
