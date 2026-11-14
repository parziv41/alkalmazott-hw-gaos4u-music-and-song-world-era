// Country shapes from Natural Earth (via world-atlas), computed once at module load.
// The 1:110m set is bundled (~30 KB gzipped) so the globe renders on the first frame; the
// 1:50m set (small island states, and crisp outlines when zoomed in) loads in the background.
import { geoContains } from 'd3-geo'
import type { Feature, Geometry, LineString, MultiLineString, Polygon, Position } from 'geojson'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import { angleBetween, boundingCircle, type BoundingCircle } from '../utils/globe'

type CountryProperties = { name: string }
export type WorldTopology = Topology<{ countries: GeometryCollection<CountryProperties> }>

/**
 * One polygon of a country (the mainland, an island, an exclave), so the ones off screen are skipped:
 * France's circle reaches Guiana and Réunion, the United States' Alaska and Hawaii. Polygons too big
 * for their circle to say much (Russia) also keep circles for stretches of their outline.
 */
export type ShapePart = BoundingCircle & { polygon: Polygon; stretches?: BoundingCircle[] }
export type AtlasShape = { id: string; name: string; feature: Feature<Geometry, CountryProperties>; parts: ShapePart[] } & BoundingCircle
export type BorderLine = { line: LineString } & BoundingCircle
export type Atlas = { shapes: Map<string, AtlasShape>; borders: BorderLine[] }

function positionsOf(geometry: Geometry): [number, number][] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates as [number, number]]
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates as [number, number][]
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat() as [number, number][]
    case 'MultiPolygon':
      return geometry.coordinates.flat(2) as [number, number][]
    case 'GeometryCollection':
      return geometry.geometries.flatMap(positionsOf)
  }
}

/** Polygons wider than this (radians, about 14°) are also checked stretch by stretch. */
const BIG_PART = 0.25
const STRETCH_POINTS = 64

function partsOf(geometry: Geometry): ShapePart[] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  return polygons.map((rings) => {
    const polygon: Polygon = { type: 'Polygon', coordinates: rings }
    const circle = boundingCircle(polygon, rings[0] as [number, number][])
    if (circle.radius < BIG_PART) return { polygon, ...circle }
    // Every ring, holes too: a view inside Lesotho still sees South Africa around it.
    const stretches: BoundingCircle[] = []
    for (const ring of rings as [number, number][][]) {
      for (let start = 0; start < ring.length - 1; start += STRETCH_POINTS) {
        const points = ring.slice(start, start + STRETCH_POINTS + 1)
        const centroid = points[Math.floor(points.length / 2)]
        let radius = 0
        for (const [lon, lat] of points) radius = Math.max(radius, angleBetween(centroid[0], centroid[1], lon, lat))
        stretches.push({ centroid, radius })
      }
    }
    return { polygon, ...circle, stretches }
  })
}

type Visible = (circle: BoundingCircle) => boolean

/**
 * A polygon is on screen if its outline crosses the screen, or if the screen lies inside it (then so
 * does the view's centre). Without stretches, its bounding circle has to do.
 */
function partVisible(part: ShapePart, visible: Visible, center: [number, number]): boolean {
  if (!visible(part)) return false
  if (!part.stretches) return true
  return part.stretches.some(visible) || geoContains(part.polygon, center)
}

/**
 * What of a country can be on screen: nothing (null), all of it, or just the polygons in view.
 * `visible` tests a bounding circle (see screenCuller); `center` is the point in the middle of the view.
 */
export function visibleGeometry(shape: AtlasShape, visible: Visible, center: [number, number]): Geometry | null {
  if (!visible(shape)) return null
  if (!shape.parts.length) return shape.feature.geometry
  const parts = shape.parts.filter((part) => partVisible(part, visible, center))
  if (parts.length === shape.parts.length) return shape.feature.geometry
  if (!parts.length) return null
  return parts.length === 1 ? parts[0].polygon : { type: 'MultiPolygon', coordinates: parts.map((part) => part.polygon.coordinates) }
}

/** Shapes keyed by atlas id, and the shared borders split into lines so off-screen ones can be skipped. */
export function buildAtlas(topology: WorldTopology): Atlas {
  const shapes = new Map<string, AtlasShape>()
  for (const f of feature(topology, topology.objects.countries).features) {
    // A few disputed areas (Kosovo, N. Cyprus, Somaliland) have no ISO id; key them by name.
    const id = String(f.id ?? f.properties.name)
    if (shapes.has(id)) continue
    shapes.set(id, { id, name: f.properties.name, feature: f, parts: partsOf(f.geometry), ...boundingCircle(f, positionsOf(f.geometry)) })
  }
  const shared: MultiLineString = mesh(topology, topology.objects.countries, (a, b) => a !== b)
  const borders = shared.coordinates.map((coordinates: Position[]) => {
    const line: LineString = { type: 'LineString', coordinates }
    return { line, ...boundingCircle(line, coordinates as [number, number][]) }
  })
  return { shapes, borders }
}

export const coarseAtlas = buildAtlas(world as unknown as WorldTopology)
export const atlasNames = new Map([...coarseAtlas.shapes.values()].map((shape) => [shape.id, shape.name]))
