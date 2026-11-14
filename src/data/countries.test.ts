import { describe, expect, it } from 'vitest'
import { flagFor } from '../components/UI/flags'
import { coarseAtlas } from './atlas'
import { countries, curatedCountries } from './index'

const atlasIds = new Set(coarseAtlas.shapes.keys())

describe('world.json', () => {
  it('has unique ids and ISO codes', () => {
    expect(new Set(countries.map((c) => c.id)).size).toBe(countries.length)
    expect(new Set(countries.map((c) => c.iso2)).size).toBe(countries.length)
  })

  it('covers the whole world, not just the curated countries', () => {
    expect(countries.length).toBeGreaterThan(180)
    expect(countries.filter((c) => c.chart).length).toBeGreaterThan(100)
  })

  it.each(countries.map((c) => [c.name, c] as const))('%s can be shown', (_, country) => {
    expect(flagFor(country.iso2), 'flag').toBeDefined()
    expect(atlasIds.has(country.id) || country.small, 'map shape or marker').toBe(true)
    expect(country.chart || country.cityCount > 0 || country.genres.length > 0, 'something to show').toBeTruthy()
    const [lon, lat] = country.center
    expect(Math.abs(lon)).toBeLessThanOrEqual(180)
    expect(Math.abs(lat)).toBeLessThanOrEqual(90)
    if (country.chart === 'shazam') expect(country.shazam).toBeTruthy()
  })
})

describe('countries.json', () => {
  it.each(curatedCountries.map((c) => [c.name, c] as const))('%s is complete', (_, country) => {
    expect(country.genres.length).toBeGreaterThanOrEqual(3)
    expect(country.genres.length).toBeLessThanOrEqual(5)
    expect(new Set(country.genres.map((g) => g.id)).size).toBe(country.genres.length)
    expect(flagFor(country.iso2), 'flag').toBeDefined()
    // Countries missing from the 110m atlas must be reachable through a marker.
    expect(atlasIds.has(country.id) || country.small, 'map shape or marker').toBe(true)

    const [west, south, east, north] = country.bbox
    expect(west).toBeLessThan(east)
    expect(south).toBeLessThan(north)
    expect(country.hue).toBeGreaterThanOrEqual(0)
    expect(country.hue).toBeLessThan(360)
    expect(country.description?.length).toBeGreaterThan(80)

    for (const genre of country.genres) {
      const { style, genre: discogsGenre, q } = genre.discogs
      expect(style || discogsGenre || q, `${genre.name} has a Discogs query`).toBeTruthy()
      expect(genre.blurb.length, `${genre.name} blurb`).toBeGreaterThan(20)
      expect(genre.era, `${genre.name} era`).not.toBe('')
    }
  })
})

describe('countries.hu.json', () => {
  it('translates every curated description and genre, and nothing else', async () => {
    const hu = (await import('./countries.hu.json')).default as Record<string, { description: string; genres: Record<string, { blurb: string; era: string }> }>
    expect(Object.keys(hu).sort()).toEqual(curatedCountries.map((c) => c.id).sort())
    for (const country of curatedCountries) {
      const entry = hu[country.id]
      expect(entry.description.length, `${country.name} description`).toBeGreaterThan(80)
      expect(Object.keys(entry.genres).sort(), `${country.name} genres`).toEqual(country.genres.map((g) => g.id).sort())
      for (const genre of country.genres) {
        expect(entry.genres[genre.id].blurb.length, `${genre.name} blurb`).toBeGreaterThan(20)
        expect(entry.genres[genre.id].era, `${genre.name} era`).not.toBe('')
      }
    }
  })
})
