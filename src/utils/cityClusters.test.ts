import { geoDistance } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import type { Country } from '../types/music'
import type { City } from '../types/places'
import { clusterCities, cityWeight } from './cityClusters'

const country = { id: '348', iso2: 'HU', name: 'Hungary' } as Country
const city = (id: string, lon: number, lat: number, artists: number, films: number, chart?: string): City => ({
  id,
  name: id,
  lon,
  lat,
  chart,
  artists: Array.from({ length: artists }, (_, i) => ({ id: `${id}a${i}`, name: 'A', kind: 'p' as const, sl: 1 })),
  films: Array.from({ length: films }, (_, i) => ({ id: `${id}f${i}`, name: 'F', sl: 1 })),
})
const budapest = city('Budapest', 19.04, 47.5, 160, 90)
const pecs = city('Pécs', 18.23, 46.07, 6, 0)
const szentendre = city('Szentendre', 19.07, 47.67, 2, 1)
const all = [budapest, pecs, szentendre].map((c) => ({ country, city: c }))
const both = { music: true, films: true }

describe('clusterCities', () => {
  it('groups exactly as checking every marker in order would, for a thousand random cities', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const many = Array.from({ length: 1000 }, (_, i) => ({ country, city: city(`c${i}`, 5 + random() * 30, 40 + random() * 15, 1 + Math.floor(random() * 40), 0) }))
    for (const radius of [900, 3000, 12000]) {
      // The plain version: every city against every marker so far, with d3's distance.
      const threshold = 60 / radius
      const expected: string[][] = []
      const centres: [number, number][] = []
      for (const { city: c } of [...many].sort((a, b) => b.city.artists.length - a.city.artists.length)) {
        const index = centres.findIndex((centre) => geoDistance(centre, [c.lon, c.lat]) < threshold)
        if (index >= 0) expected[index].push(c.id)
        else {
          centres.push([c.lon, c.lat])
          expected.push([c.id])
        }
      }
      expect(clusterCities(many, both, radius).map((cluster) => cluster.members.map((m) => m.city.id))).toEqual(expected)
    }
  })

  it('merges nearby cities into the heaviest one when zoomed out', () => {
    const clusters = clusterCities(all, both, 3000)
    const capital = clusters.find((c) => c.key === 'Budapest')!
    expect(capital.members.map((m) => m.city.id)).toEqual(['Budapest', 'Szentendre'])
    expect(capital.artists).toBe(162)
    expect(clusters.find((c) => c.key === 'Pécs')?.members).toHaveLength(1)
  })

  it('lets a dominant city speak for its cluster, but not a balanced one', () => {
    const clusters = clusterCities(all, both, 3000)
    expect(clusters.find((c) => c.key === 'Budapest')?.lead?.city.id).toBe('Budapest')
    const twins = clusterCities(
      [city('A', 19, 47, 10, 0), city('B', 19.01, 47.01, 9, 0), city('C', 19.02, 47, 9, 0)].map((c) => ({ country, city: c })),
      both,
      3000,
    )
    expect(twins).toHaveLength(1)
    expect(twins[0].lead).toBeUndefined()
  })

  it('separates them when zoomed in', () => {
    expect(clusterCities(all, both, 60000)).toHaveLength(3)
  })

  it('respects the layer toggles', () => {
    const filmsOnly = clusterCities(all, { music: false, films: true }, 60000)
    expect(filmsOnly.map((c) => c.key).sort()).toEqual(['Budapest', 'Szentendre'])
    expect(filmsOnly.every((c) => c.artists === 0)).toBe(true)
  })

  it('weighs a city chart like a few artists', () => {
    expect(cityWeight(city('Paris', 2.35, 48.86, 0, 0, 'paris'), both)).toBe(3)
  })
})
