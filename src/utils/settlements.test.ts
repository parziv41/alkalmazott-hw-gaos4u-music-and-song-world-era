import { describe, expect, it } from 'vitest'
import type { City, Settlement } from '../types/places'
import { cityFor, fold, labelBox, nearestCity, placeLabels } from './settlements'

const city = (id: string, name: string, lon: number, lat: number): City => ({ id, name, lon, lat, artists: [], films: [] })
const settlement = (id: string, name: string, lon: number, lat: number, population = 1000): Settlement => ({
  id,
  name,
  iso2: 'HU',
  lon,
  lat,
  population,
  region: 'Baranya',
})
const pecs = city('Q45779', 'Pécs', 18.233, 46.071)
const budapest = city('Q1781', 'Budapest', 19.04, 47.498)

describe('fold', () => {
  it('drops accents and case', () => {
    expect(fold('Pécs')).toBe('pecs')
    expect(fold('Hódmezővásárhely')).toBe('hodmezovasarhely')
  })
})

describe('cityFor', () => {
  it('matches the same Wikidata item', () => {
    expect(cityFor(settlement('Q45779', 'Pécs', 18.23, 46.07), [budapest, pecs])).toBe(pecs)
  })

  it('matches the same name nearby, but not a namesake far away', () => {
    expect(cityFor(settlement('g1', 'Pecs', 18.25, 46.08), [pecs])).toBe(pecs)
    expect(cityFor(settlement('g2', 'Pécs', 21, 48), [pecs])).toBeUndefined()
  })
})

describe('nearestCity', () => {
  it('finds the closest city and its distance', () => {
    const abaliget = settlement('Q305294', 'Abaliget', 18.117, 46.144, 615)
    const nearest = nearestCity(abaliget, [budapest, pecs])
    expect(nearest?.city).toBe(pecs)
    expect(nearest?.km).toBeGreaterThan(10)
    expect(nearest?.km).toBeLessThan(15)
  })
})

describe('placeLabels', () => {
  const at = (id: string, x: number, y: number) => ({ id, name: id, x, y })

  it('keeps the first label of overlapping ones and skips occupied space', () => {
    const placed = placeLabels([at('Big', 100, 100), at('Close', 110, 102), at('Far', 300, 300), at('Busy', 500, 500)], [{ x: 495, y: 495, width: 20, height: 20 }], 10)
    expect(placed.map((label) => label.id)).toEqual(['Big', 'Far'])
  })

  it('stops at the maximum', () => {
    expect(placeLabels([at('A', 0, 0), at('B', 0, 100), at('C', 0, 200)], [], 2)).toHaveLength(2)
  })

  it('sizes a label by its text', () => {
    expect(labelBox(at('Abaliget', 0, 0)).width).toBeGreaterThan(labelBox(at('Pécs', 0, 0)).width)
  })
})
