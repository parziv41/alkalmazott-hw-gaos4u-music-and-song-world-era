import { describe, expect, it } from 'vitest'
import { searchArtists } from './artists.ts'

describe('searchArtists', () => {
  it('finds an artist by any word of the name, without accents, with where they come from', () => {
    const [beatles] = searchArtists('beatles')
    expect(beatles).toMatchObject({ name: 'The Beatles', iso2: 'GB', kind: 'g' })
    expect(beatles.year).toBeGreaterThan(1955)
    // Hungarian artists go by their Hungarian name; the English one ("Kati Kovács") matches too.
    expect(searchArtists('kovacs kati')[0]).toMatchObject({ name: 'Kovács Kati', alias: 'Kati Kovács', iso2: 'HU', kind: 'p' })
    expect(searchArtists('kati kovacs')[0].name).toBe('Kovács Kati')
  })

  it('knows Hungarian musicians and bands well beyond the best known', () => {
    for (const name of ['Koncz Zsuzsa', 'Halott Pénz', 'Wellhello', 'Quimby', 'Locomotiv GT', 'Szörényi Levente', 'Korda György']) {
      expect(searchArtists(name, 3).map((artist) => artist.name), name).toContain(name)
    }
  })

  it('puts names that start with the query first, and needs two letters', () => {
    expect(searchArtists('omega')[0].name.toLowerCase().startsWith('omega')).toBe(true)
    expect(searchArtists('o')).toEqual([])
    expect(searchArtists('beatles', 3).length).toBeLessThanOrEqual(3)
  })
})
