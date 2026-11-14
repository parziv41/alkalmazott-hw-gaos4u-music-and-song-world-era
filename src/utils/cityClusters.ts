import type { Country } from '../types/music'
import type { City } from '../types/places'

export type Layers = { music: boolean; films: boolean }
export type PlacedCity = { country: Country; city: City }

export type CityCluster = {
  /** The heaviest city's id, so keys stay stable while the cluster's other members change. */
  key: string
  lon: number
  lat: number
  members: PlacedCity[]
  artists: number
  films: number
  /** Whether any member has a Shazam city chart. */
  chart: boolean
  /** The city that dominates the cluster (Budapest among its suburbs): the marker opens it directly. */
  lead?: PlacedCity
}

/** Share of a cluster's weight above which its heaviest city speaks for it. */
const LEAD_SHARE = 0.5

/** How much a city matters on the map with the current layers: its artists, films and chart. */
export function cityWeight(city: City, layers: Layers): number {
  return (layers.music ? city.artists.length + (city.chart ? 3 : 0) : 0) + (layers.films ? city.films.length : 0)
}

const RAD = Math.PI / 180
type Point3 = [number, number, number]
const unitVector = (lon: number, lat: number): Point3 => {
  const cosLat = Math.cos(lat * RAD)
  return [cosLat * Math.cos(lon * RAD), cosLat * Math.sin(lon * RAD), Math.sin(lat * RAD)]
}

/**
 * Greedy screen-space clustering: heaviest cities first, and every city within `pixels` of an
 * existing marker joins the first such marker. Angular distance × globe radius is the on-screen
 * distance near the centre.
 *
 * Markers sit in a grid on the unit sphere with cells as wide as the joining distance (as a chord),
 * so a city only looks at the markers in the 27 cells around it, not at all of them: with a dozen
 * countries' cities loaded, that is the difference between a second and a few milliseconds.
 */
export function clusterCities(cities: PlacedCity[], layers: Layers, globeRadiusPx: number, pixels = 60): CityCluster[] {
  const threshold = Math.min(pixels / Math.max(globeRadiusPx, 1), Math.PI)
  const chord = 2 * Math.sin(threshold / 2)
  const weighted = cities
    .map((placed) => ({ placed, weight: cityWeight(placed.city, layers) }))
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight)

  const clusters: CityCluster[] = []
  const grid = new Map<string, { cluster: CityCluster; order: number; at: Point3 }[]>()
  const cellOf = (at: Point3) => at.map((v) => Math.floor(v / chord))
  const nearest = (at: Point3): CityCluster | undefined => {
    const [cx, cy, cz] = cellOf(at)
    let best: { cluster: CityCluster; order: number } | undefined
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const entry of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
            const d2 = (entry.at[0] - at[0]) ** 2 + (entry.at[1] - at[1]) ** 2 + (entry.at[2] - at[2]) ** 2
            // The first marker made wins, as a scan of the list in order would find it.
            if (d2 < chord * chord && (!best || entry.order < best.order)) best = entry
          }
    return best?.cluster
  }

  for (const { placed } of weighted) {
    const { city } = placed
    const at = unitVector(city.lon, city.lat)
    const near = nearest(at)
    const artists = layers.music ? city.artists.length : 0
    const films = layers.films ? city.films.length : 0
    const chart = layers.music && !!city.chart
    if (near) {
      near.members.push(placed)
      near.artists += artists
      near.films += films
      near.chart ||= chart
    } else {
      const cluster: CityCluster = { key: city.id, lon: city.lon, lat: city.lat, members: [placed], artists, films, chart }
      const cell = cellOf(at).join()
      grid.set(cell, [...(grid.get(cell) ?? []), { cluster, order: clusters.length, at }])
      clusters.push(cluster)
    }
  }
  for (const cluster of clusters) {
    const [first] = cluster.members
    const total = cluster.members.reduce((sum, member) => sum + cityWeight(member.city, layers), 0)
    if (cluster.members.length === 1 || cityWeight(first.city, layers) >= total * LEAD_SHARE) cluster.lead = first
  }
  return clusters
}
