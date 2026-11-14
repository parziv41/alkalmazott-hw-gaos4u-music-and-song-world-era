import { geoDistance, geoPath } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { angleBetween, nearSidePath, baseRadius, cityView, fitView, spanForPopulation, interpolateView, isFacing, projectionFor, rotateBy, visibleCap, visibleCenter, zoomAt, type View } from './globe'
import { mapInsets } from './layout'

const size = { width: 1440, height: 900 }
const radius = baseRadius(size, true)
const at = (view: Partial<View> = {}): View => ({ lon: 0, lat: 0, k: 1, x: size.width / 2, y: size.height / 2, ...view })

describe('angleBetween', () => {
  it('matches d3’s geoDistance, across the antimeridian and the poles too', () => {
    const points: [number, number][] = [[19.04, 47.5], [2.35, 48.86], [-179.5, 10], [179.5, -10], [0, 90], [120, -89.9], [-74, 40.7], [151.2, -33.9], [19.04, 47.5001]]
    for (const a of points) for (const b of points) expect(angleBetween(a[0], a[1], b[0], b[1])).toBeCloseTo(geoDistance(a, b), 9)
  })
})

describe('nearSidePath', () => {
  it('draws the same path as d3 for shapes on the near side', () => {
    const view: View = { lon: 19, lat: 47, k: 1, x: 400, y: 300 }
    const size = { width: 800, height: 600 }
    // Clockwise, as d3 (and the atlas) wind outer rings.
    const hungary = { type: 'Polygon' as const, coordinates: [[[16, 46], [17, 48], [21, 48.6], [22.9, 47.9], [16, 46]]] }
    const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const ours = numbers(nearSidePath(view, 250).geometry(hungary)!)
    const d3s = numbers(geoPath(projectionFor(view, 250, size)).digits(1)(hungary)!)
    // d3 drops the ring's repeated closing point.
    expect(ours.slice(0, d3s.length).every((value, i) => Math.abs(value - d3s[i]) <= 0.1)).toBe(true)
    expect(nearSidePath(view, 250).facing({ centroid: [19, 47], radius: 0.1 })).toBe(true)
    expect(nearSidePath(view, 250).facing({ centroid: [-160, -40], radius: 0.1 })).toBe(false)
  })
})

describe('fitView', () => {
  const hungary: [number, number, number, number] = [16.1, 45.7, 22.9, 48.6]
  const center: [number, number] = [19.5, 47.15]

  it('centres the country in the area left of the desktop panel', () => {
    const insets = mapInsets(size, true, true)
    const view = fitView(hungary, center, size, insets, radius)
    const projected = projectionFor(view, radius, size)(center)!
    const [vx, vy] = visibleCenter(size, insets)
    expect(projected[0]).toBeCloseTo(vx, -1)
    expect(projected[1]).toBeCloseTo(vy, -1)
    expect(projected[0]).toBeLessThan(size.width - insets.right)
  })

  it('zooms small countries in and keeps huge ones at the whole globe', () => {
    const insets = mapInsets(size, true, true)
    expect(fitView(hungary, center, size, insets, radius).k).toBeGreaterThan(5)
    expect(fitView([-180, -60, 180, 80], [0, 10], size, insets, radius).k).toBe(1)
  })

  it('handles boxes that cross the antimeridian', () => {
    const insets = mapInsets(size, true, true)
    const fiji = fitView([177, -19, -179, -16], [179, -17.5], size, insets, radius)
    expect(fiji.k).toBeGreaterThan(5)
  })
})

describe('zoomAt', () => {
  it('keeps the point under the cursor in place', () => {
    const view = at({ lon: 10, lat: 40, k: 2 })
    const cursor: [number, number] = [size.width / 2 + 180, size.height / 2 - 120]
    const before = projectionFor(view, radius, size).invert!(cursor)!
    const next = zoomAt(view, 1.8, cursor, radius, size)
    const after = projectionFor(next, radius, size)(before)!
    expect(next.k).toBeCloseTo(3.6)
    expect(after[0]).toBeCloseTo(cursor[0], 0)
    expect(after[1]).toBeCloseTo(cursor[1], 0)
  })

  it('zooms around the centre when the cursor is off the globe', () => {
    const view = at()
    const next = zoomAt(view, 2, [5, 5], radius, size)
    expect([next.lon, next.lat]).toEqual([0, 0])
    expect(next.k).toBe(2)
  })
})

describe('rotateBy', () => {
  it('drags the surface along with the pointer and keeps north up', () => {
    const view = at({ lon: 20, lat: 10 })
    const right = rotateBy(view, 100, 0, radius)
    expect(right.lon).toBeLessThan(20) // dragging right brings the west into view
    const down = rotateBy(view, 0, 100, radius)
    expect(down.lat).toBeGreaterThan(10)
  })

  it('wraps longitude and turns up to the pole, but not over it', () => {
    const view = rotateBy(at({ lon: -179, lat: 80 }), 400, 2000, radius)
    expect(view.lon).toBeGreaterThanOrEqual(-180)
    expect(view.lon).toBeLessThanOrEqual(180)
    expect(view.lat).toBe(90)
    expect(rotateBy(at({ lat: -80 }), 0, -2000, radius).lat).toBe(-90)
  })
})

describe('visibility', () => {
  it('sees a hemisphere when zoomed out and a small cap when zoomed in', () => {
    expect(visibleCap(at(), radius, size)).toBeCloseTo(Math.PI / 2)
    expect(visibleCap(at({ k: 20 }), radius, size)).toBeLessThan(0.15)
    expect(visibleCap(at({ k: 40 }), radius, size)).toBeLessThan(visibleCap(at({ k: 20 }), radius, size))
  })

  it('knows which side of the globe a point is on', () => {
    expect(isFacing(at(), [30, 20])).toBe(true)
    expect(isFacing(at(), [170, 0])).toBe(false)
  })
})

describe('cityView', () => {
  it('zooms closer for a village than for a city', () => {
    const insets = mapInsets(size, true, true)
    const village = cityView(18.1, 46.1, size, insets, radius, 1, spanForPopulation(600))
    const city = cityView(19, 47.5, size, insets, radius, 1, spanForPopulation(1_700_000))
    expect(village.k).toBeGreaterThan(city.k * 2)
    expect(village.k).toBeLessThanOrEqual(90) // the closest the globe zooms
  })
})

describe('interpolateView', () => {
  it('follows the great circle and starts and ends at the given views', () => {
    const from = at({ lon: 19, lat: 47, k: 8 })
    const to = at({ lon: 139, lat: 36, k: 8 })
    const flight = interpolateView(from, to)
    expect(flight.at(0).k).toBeCloseTo(8)
    expect(geoDistance([flight.at(1).lon, flight.at(1).lat], [139, 36])).toBeLessThan(1e-6)
    // A long trip zooms out on the way.
    expect(flight.at(0.5).k).toBeLessThan(3)
    expect(flight.duration).toBeGreaterThan(1000)
  })

  it('does not dip for short hops', () => {
    const flight = interpolateView(at({ lon: 19, lat: 47, k: 2 }), at({ lon: 21, lat: 47, k: 2 }))
    expect(flight.at(0.5).k).toBeCloseTo(2)
  })
})
