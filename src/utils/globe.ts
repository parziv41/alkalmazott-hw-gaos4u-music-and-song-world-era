// Camera math for the orthographic globe. A view is the geographic point at the centre of the
// globe, a zoom factor, and where on screen that point is drawn (left of the panel when it's open).
import { geoCentroid, geoInterpolate, geoOrthographic, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo'
import type { Geometry, Position } from 'geojson'
import type { BBox } from '../types/music'

export type Size = { width: number; height: number }
export type Insets = { top: number; right: number; bottom: number; left: number }
export type View = { lon: number; lat: number; k: number; x: number; y: number }
/** A geographic centre and the angular radius (radians) that encloses a shape. */
export type BoundingCircle = { centroid: [number, number]; radius: number }

const RAD = Math.PI / 180

/**
 * The great-circle angle between two points, in radians (haversine). The same as d3's geoDistance,
 * which builds a line and sums it with an exact adder: far too slow for the thousands of calls a frame.
 */
export function angleBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const sinLat = Math.sin(((lat2 - lat1) * RAD) / 2)
  const sinLon = Math.sin(((lon2 - lon1) * RAD) / 2)
  const h = sinLat * sinLat + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * sinLon * sinLon
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const MIN_K = 0.85
export const MAX_K = 90
// Like a globe on its stand: it tilts right up to either pole, but never over the top.
const MAX_LAT = 90
const DEG = 180 / Math.PI

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

/** Globe radius at zoom 1: the whole sphere fits between the top bar and the bottom edge. */
export function baseRadius(size: Size, isDesktop: boolean): number {
  const top = isDesktop ? 76 : 64
  const bottom = isDesktop ? 60 : 28
  const side = isDesktop ? 32 : 14
  return Math.max(60, Math.min(size.width / 2 - side, (size.height - top - bottom) / 2) * 0.96)
}

/** Centre of the part of the screen not covered by panels. */
export function visibleCenter(size: Size, insets: Insets): [number, number] {
  return [insets.left + (size.width - insets.left - insets.right) / 2, insets.top + (size.height - insets.top - insets.bottom) / 2]
}

export function projectionFor(view: View, radius: number, size: Size): GeoProjection {
  const r = radius * view.k
  const projection = geoOrthographic()
    .rotate([-view.lon, -view.lat, 0])
    .scale(r)
    .translate([view.x, view.y])
    // The atlas points are close enough together that resampling only costs time.
    .precision(0)
  // Clipping to the screen only pays off once the globe is bigger than it.
  const fits = view.x - r >= 0 && view.y - r >= 0 && view.x + r <= size.width && view.y + r <= size.height
  return fits
    ? projection
    : projection.clipExtent([
        [-2, -2],
        [size.width + 2, size.height + 2],
      ])
}

/**
 * The view that frames a lon/lat box in the visible part of the screen. Orthographic coordinates
 * scale linearly with the zoom, so the box is measured once at zoom 1.
 */
export function fitView(
  bbox: BBox,
  center: [number, number],
  size: Size,
  insets: Insets,
  radius: number,
  { fill = 0.62, maxK = 40 } = {},
): View {
  const [west, south, rawEast, north] = bbox
  const east = rawEast < west ? rawEast + 360 : rawEast
  const unit = geoOrthographic().rotate([-center[0], -center[1], 0]).scale(radius).translate([0, 0])
  const xs: number[] = []
  const ys: number[] = []
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const lon = west + ((east - west) * i) / steps
    const lat = south + ((north - south) * i) / steps
    for (const point of [[lon, south], [lon, north], [west, lat], [east, lat]] as [number, number][]) {
      const projected = unit(point)
      if (projected) {
        xs.push(projected[0])
        ys.push(projected[1])
      }
    }
  }
  const [vx, vy] = visibleCenter(size, insets)
  if (!xs.length) return { lon: center[0], lat: center[1], k: 1, x: vx, y: vy }
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const visibleWidth = Math.max(size.width - insets.left - insets.right, 1)
  const visibleHeight = Math.max(size.height - insets.top - insets.bottom, 1)
  const k = clamp(Math.min((visibleWidth * fill) / Math.max(x1 - x0, 1), (visibleHeight * fill) / Math.max(y1 - y0, 1)), 1, maxK)
  // Put the middle of the projected box, not just the box's centre point, in the middle of the view.
  return { lon: center[0], lat: center[1], k, x: vx - (k * (x0 + x1)) / 2, y: vy - (k * (y0 + y1)) / 2 }
}

/** Kilometres across the visible area when a city is opened. */
export const CITY_SPAN_KM = 420

/** How much of the map to show around a town: a village gets a close-up, a city its surroundings. */
export function spanForPopulation(population: number): number {
  return population < 5_000 ? 70 : population < 50_000 ? 130 : population < 500_000 ? 240 : CITY_SPAN_KM
}

export function cityView(
  lon: number,
  lat: number,
  size: Size,
  insets: Insets,
  radius: number,
  currentK: number,
  spanKm = CITY_SPAN_KM,
): View {
  const [vx, vy] = visibleCenter(size, insets)
  const visibleWidth = Math.max(Math.min(size.width - insets.left - insets.right, size.height - insets.top - insets.bottom), 1)
  const k = clamp((visibleWidth / (spanKm / 6371)) / radius, 1, MAX_K)
  return { lon, lat, k: Math.max(k, Math.min(currentK, MAX_K)), x: vx, y: vy }
}

/** Turns the globe as if the cursor were dragging its surface; north stays up, like a globe on a stand. */
export function rotateBy(view: View, dx: number, dy: number, radius: number): View {
  const r = radius * view.k
  const cos = Math.max(Math.cos(view.lat / DEG), 0.3)
  return { ...view, lon: wrapLon(view.lon - (dx / r) * (DEG / cos)), lat: clamp(view.lat + (dy / r) * DEG, -MAX_LAT, MAX_LAT) }
}

/** Zooms so the point under the cursor stays under the cursor. */
export function zoomAt(view: View, factor: number, point: [number, number], radius: number, size: Size): View {
  const k = clamp(view.k * factor, MIN_K, MAX_K)
  if (k === view.k) return view
  const before = projectionFor(view, radius, size).invert?.(point)
  let next: View = { ...view, k }
  if (!before || !before.every(Number.isFinite) || !isOnGlobe(view, point, radius)) return next
  // Orthographic has no closed form for this; two corrections converge to well under a pixel.
  for (let i = 0; i < 3; i++) {
    const after = projectionFor(next, radius, size).invert?.(point)
    if (!after || !after.every(Number.isFinite)) break
    next = { ...next, lon: wrapLon(next.lon + (before[0] - after[0])), lat: clamp(next.lat + (before[1] - after[1]), -MAX_LAT, MAX_LAT) }
  }
  return next
}

export function isOnGlobe(view: View, [px, py]: [number, number], radius: number): boolean {
  return Math.hypot(px - view.x, py - view.y) < radius * view.k * 0.98
}

/** Angular radius (radians) of the globe that can be on screen; π/2 while the whole disc fits. */
export function visibleCap(view: View, radius: number, size: Size): number {
  const r = radius * view.k
  const far = Math.max(
    Math.hypot(view.x, view.y),
    Math.hypot(size.width - view.x, view.y),
    Math.hypot(view.x, size.height - view.y),
    Math.hypot(size.width - view.x, size.height - view.y),
  )
  return far >= r ? Math.PI / 2 : Math.asin(far / r)
}

/** Whether any part of a shape can be on screen: in front of the horizon and inside the viewport's cap. */
export function mayBeVisible(view: View, circle: BoundingCircle, cap: number): boolean {
  return angleBetween(view.lon, view.lat, circle.centroid[0], circle.centroid[1]) - circle.radius < cap
}

/**
 * A tighter test than mayBeVisible, made once per frame: whether a shape's bounding circle reaches the
 * screen rectangle. The cap circle is centred on the view's centre, which sits left of the panel, so it
 * covers two and a half screens. Orthographic projection never stretches distances, so a circle of
 * angular radius ρ stays within ρ × the globe's radius in pixels of its projected centre.
 */
export function screenCuller(view: View, radius: number, size: Size, projection: GeoProjection): (circle: BoundingCircle) => boolean {
  const r = radius * view.k
  const cap = visibleCap(view, radius, size)
  return (circle) => {
    const angle = angleBetween(view.lon, view.lat, circle.centroid[0], circle.centroid[1])
    if (angle - circle.radius >= cap) return false
    // Centre behind the horizon, edge reaching over it: too close to call cheaply.
    if (angle >= Math.PI / 2 - 0.01) return true
    const point = projection(circle.centroid)
    if (!point) return true
    const reach = Math.min(circle.radius, Math.PI) * r
    return point[0] + reach >= 0 && point[0] - reach <= size.width && point[1] + reach >= 0 && point[1] - reach <= size.height
  }
}

/**
 * SVG paths for shapes wholly on the near side of the globe, projected directly: a few multiplications
 * a point, where d3 runs every point through rotation, clipping at the horizon and clipping to the
 * screen. Zoomed in, nearly everything drawn is on the near side, and this is several times faster.
 * Shapes that cross the horizon still need d3 (`facing` says which).
 */
export function nearSidePath(view: View, radius: number) {
  const r = radius * view.k
  const lambda0 = view.lon * RAD
  const sinPhi0 = Math.sin(view.lat * RAD)
  const cosPhi0 = Math.cos(view.lat * RAD)
  const round = (value: number) => Math.round(value * 10) / 10
  const line = (points: Position[], close: boolean): string => {
    let d = ''
    for (let i = 0; i < points.length; i++) {
      const lambda = points[i][0] * RAD - lambda0
      const phi = points[i][1] * RAD
      const cosPhi = Math.cos(phi)
      const x = view.x + r * cosPhi * Math.sin(lambda)
      const y = view.y - r * (cosPhi0 * Math.sin(phi) - sinPhi0 * cosPhi * Math.cos(lambda))
      d += `${i ? 'L' : 'M'}${round(x)},${round(y)}`
    }
    return close && d ? `${d}Z` : d
  }
  const polygon = (rings: Position[][]) => rings.map((ring) => line(ring, true)).join('')
  return {
    /** Whether all of a bounding circle is on the near side, with a little room. */
    facing: (circle: BoundingCircle) => angleBetween(view.lon, view.lat, circle.centroid[0], circle.centroid[1]) + circle.radius < Math.PI / 2 - 0.02,
    lines: (lines: Position[][]) => lines.map((points) => line(points, false)).join(''),
    /** Polygons and lines; null for anything else, which d3 should draw. */
    geometry: (geometry: Geometry): string | null => {
      switch (geometry.type) {
        case 'Polygon':
          return polygon(geometry.coordinates)
        case 'MultiPolygon':
          return geometry.coordinates.map(polygon).join('')
        case 'LineString':
          return line(geometry.coordinates, false)
        case 'MultiLineString':
          return geometry.coordinates.map((points) => line(points, false)).join('')
        default:
          return null
      }
    },
  }
}

export function isFacing(view: View, point: [number, number], margin = 0.02): boolean {
  return angleBetween(view.lon, view.lat, point[0], point[1]) < Math.PI / 2 - margin
}

export function boundingCircle(object: GeoPermissibleObjects & { type: string }, coordinates: [number, number][]): BoundingCircle {
  const centroid = geoCentroid(object) as [number, number]
  let radius = 0
  for (const point of coordinates) radius = Math.max(radius, angleBetween(centroid[0], centroid[1], point[0], point[1]))
  return { centroid, radius }
}

/**
 * A camera flight: the centre follows the great circle, and the zoom dips out far enough
 * to keep both ends of a long trip in sight, then settles in.
 */
export function interpolateView(from: View, to: View): { at: (t: number) => View; duration: number } {
  const distance = angleBetween(from.lon, from.lat, to.lon, to.lat)
  const center = geoInterpolate([from.lon, from.lat], [to.lon, to.lat])
  const logFrom = Math.log(from.k)
  const logTo = Math.log(to.k)
  const dip = clamp(1 / Math.max(distance, 1e-3), 1, Math.min(from.k, to.k))
  const bend = dip < Math.min(from.k, to.k) ? 2 * Math.log(dip) - (logFrom + logTo) / 2 : (logFrom + logTo) / 2
  const at = (t: number): View => {
    const [lon, lat] = distance > 1e-6 ? center(t) : [to.lon, to.lat]
    const logK = (1 - t) ** 2 * logFrom + 2 * t * (1 - t) * bend + t ** 2 * logTo
    return { lon, lat, k: Math.exp(logK), x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  }
  const zoomChange = Math.abs(logTo - logFrom) / Math.LN10
  const duration = clamp(650 + 650 * (distance / (Math.PI / 2)) + 380 * zoomChange, 650, 2000)
  return { at, duration }
}
