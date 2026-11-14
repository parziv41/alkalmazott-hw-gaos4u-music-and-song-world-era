import { useQuery } from '@tanstack/react-query'
import type { LineString, Polygon } from 'geojson'
import type { BoundingCircle } from '../utils/globe'

/** Centre and angular radius in thousandths of a radian, precomputed by scripts/build-water.ts. */
type Circle = [number, number, number]
type WaterFile = {
  rivers: [string, string, number, Circle, number[]][]
  lakes: [string, string, number, Circle, number[][]][]
}

type Named = {
  name: string
  /** Hungarian name, used for labels inside Hungary. */
  hu: string
  /** Zoom factor from which the globe draws it. */
  k: number
}
export type River = Named & BoundingCircle & { line: LineString }
export type Lake = Named & BoundingCircle & { polygon: Polygon; size: number }
export type Water = { rivers: River[]; lakes: Lake[] }

/** Undoes scripts/build-water.ts' encoding: thousandths of a degree, each point a step from the last. */
export function decode(values: number[]): [number, number][] {
  const points: [number, number][] = []
  let x = 0
  let y = 0
  for (let i = 0; i + 1 < values.length; i += 2) {
    x += values[i]
    y += values[i + 1]
    points.push([x / 1000, y / 1000])
  }
  return points
}

const circleOf = ([lon, lat, radius]: Circle): BoundingCircle => ({ centroid: [lon, lat], radius: radius / 1000 })

const RAD = Math.PI / 180

/** Drops points closer than `tolerance` degrees to the last one kept; the ends always stay. */
export function thin(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points
  const kept: [number, number][] = [points[0]]
  const squared = tolerance * tolerance
  let [lastLon, lastLat] = points[0]
  for (let i = 1; i < points.length - 1; i++) {
    const [lon, lat] = points[i]
    const dx = (lon - lastLon) * Math.cos(lat * RAD)
    const dy = lat - lastLat
    if (dx * dx + dy * dy < squared) continue
    kept.push(points[i])
    lastLon = lon
    lastLat = lat
  }
  kept.push(points[points.length - 1])
  return kept
}

const thinned = new WeakMap<Water, Map<number, Water>>()

/**
 * Rivers and lakes with no more points than the zoom can show: about one per pixel near the centre.
 * Full detail costs 20 ms a frame over Europe; this is computed once per half-octave of zoom.
 */
export function waterForZoom(water: Water, k: number, radius: number): Water {
  const step = 2 ** (Math.floor(Math.log2(k) * 2) / 2)
  const cache = thinned.get(water) ?? new Map<number, Water>()
  thinned.set(water, cache)
  const hit = cache.get(step)
  if (hit) return hit
  // Degrees per pixel at the centre of the globe, at the lower end of this zoom step.
  const tolerance = 0.7 / (radius * step * RAD)
  const result: Water = {
    rivers: water.rivers.map((river) => ({ ...river, line: { type: 'LineString', coordinates: thin(river.line.coordinates as [number, number][], tolerance) } })),
    lakes: water.lakes.map((lake) => ({
      ...lake,
      polygon: { type: 'Polygon', coordinates: lake.polygon.coordinates.map((ring) => thin(ring as [number, number][], tolerance)) },
    })),
  }
  cache.set(step, result)
  return result
}

function build(file: WaterFile): Water {
  const rivers = file.rivers.map(([name, hu, k, circle, values]) => {
    const line: LineString = { type: 'LineString', coordinates: decode(values) }
    return { name, hu, k, line, ...circleOf(circle) }
  })
  const lakes = file.lakes.map(([name, hu, k, circle, ringValues]) => {
    const polygon: Polygon = { type: 'Polygon', coordinates: ringValues.map(decode) }
    const bounds = circleOf(circle)
    return { name, hu, k, polygon, ...bounds, size: bounds.radius }
  })
  return { rivers, lakes }
}

/** Rivers and lakes (public/data/water.json, ~300 KB), loaded once the globe is zoomed in a little. */
export function useWater(enabled: boolean) {
  return useQuery({
    queryKey: ['water'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/data/water.json', { signal })
      if (!response.ok) throw new Error(`Could not load rivers and lakes (${response.status})`)
      return build((await response.json()) as WaterFile)
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
