import { describe, expect, it } from 'vitest'
import { antisolarPoint, subsolarPoint } from './sun'

describe('subsolarPoint', () => {
  it('is over the equator near Greenwich at the March equinox noon', () => {
    const [lon, lat] = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12)))
    expect(Math.abs(lat)).toBeLessThan(0.6)
    expect(Math.abs(lon)).toBeLessThan(3) // the equation of time shifts it by about 2°
  })

  it('is over the Tropic of Cancer at the June solstice', () => {
    const [, lat] = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12)))
    expect(lat).toBeCloseTo(23.44, 0)
  })

  it('moves west 15° an hour', () => {
    const [noon] = subsolarPoint(new Date(Date.UTC(2026, 8, 1, 12)))
    const [later] = subsolarPoint(new Date(Date.UTC(2026, 8, 1, 14)))
    expect(noon - later).toBeCloseTo(30, 0)
  })
})

describe('antisolarPoint', () => {
  it('is on the opposite side of the globe', () => {
    const date = new Date(Date.UTC(2026, 5, 21, 18))
    const [lon, lat] = subsolarPoint(date)
    const [antiLon, antiLat] = antisolarPoint(date)
    expect(antiLat).toBeCloseTo(-lat)
    expect(Math.abs(Math.abs(antiLon - lon) - 180)).toBeLessThan(1e-9)
  })
})
