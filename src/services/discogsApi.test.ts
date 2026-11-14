import { describe, expect, it, vi } from 'vitest'
import type { DiscogsSearchResult } from '../types/discogs'
import type { Country, Genre } from '../types/music'
import { buildAttempts, normalizeResult, parseDiscogsTitle, pickTopReleases, searchReleases, type SearchFetcher } from './discogsApi'

const genre = (discogs: Genre['discogs'], name = 'Bossa Nova'): Genre => ({ id: 'g', name, era: '', blurb: '', discogs })
const country = (genres: Genre[] = []): Country => ({
  id: '076',
  iso2: 'BR',
  name: 'Brazil',
  region: 'South America',
  hue: 150,
  bbox: [-74, -33, -34, 5],
  center: [-54, -14],
  cityCount: 0,
  artistCount: 0,
  filmCount: 0,
  description: '',
  discogsCountry: 'Brazil',
  genres,
})

const result = (overrides: Partial<DiscogsSearchResult>): DiscogsSearchResult => ({
  id: 1,
  type: 'master',
  title: 'João Gilberto - Chega De Saudade',
  year: '1959',
  cover_image: 'https://i.discogs.com/cover.jpg',
  uri: '/master/1-Chega-De-Saudade',
  label: ['Odeon'],
  format: ['Vinyl', 'LP', 'Album'],
  community: { have: 100, want: 50 },
  ...overrides,
})

describe('parseDiscogsTitle', () => {
  it('splits artist and title on the first separator', () => {
    expect(parseDiscogsTitle('Os Mutantes - Os Mutantes - Live')).toEqual({ artist: 'Os Mutantes', title: 'Os Mutantes - Live' })
  })

  it('strips disambiguation numbers and name-variation asterisks', () => {
    expect(parseDiscogsTitle('Gal Costa (2)* & Caetano Veloso - Domingo').artist).toBe('Gal Costa & Caetano Veloso')
  })

  it('treats a title without a separator as a compilation', () => {
    expect(parseDiscogsTitle('Brazil Classics')).toEqual({ artist: 'Various', title: 'Brazil Classics' })
  })
})

describe('normalizeResult', () => {
  it('maps a search result to a release', () => {
    expect(normalizeResult(result({}))).toEqual({
      id: 1,
      artist: 'João Gilberto',
      title: 'Chega De Saudade',
      year: 1959,
      coverUrl: 'https://i.discogs.com/cover.jpg',
      label: 'Odeon',
      format: 'LP',
      discogsUrl: 'https://www.discogs.com/master/1-Chega-De-Saudade',
      popularity: 100,
    })
  })

  it('drops Discogs placeholder images and missing years', () => {
    const release = normalizeResult(result({ cover_image: 'https://s.discogs.com/images/spacer.gif', thumb: '', year: '' }))
    expect(release?.coverUrl).toBeUndefined()
    expect(release?.year).toBeUndefined()
  })

  it('ignores artists and labels', () => {
    expect(normalizeResult(result({ type: 'artist' }))).toBeNull()
  })
})

describe('pickTopReleases', () => {
  it('sorts by collectors, de-duplicates and keeps three', () => {
    const picked = pickTopReleases([
      result({ id: 1, title: 'A - One', community: { have: 10 } }),
      result({ id: 2, title: 'B - Two', community: { have: 500 } }),
      result({ id: 3, title: 'B - Two', community: { have: 400 } }),
      result({ id: 4, title: 'C - Three', community: { have: 300 } }),
      result({ id: 5, title: 'D - Four', community: { have: 200 } }),
    ])
    expect(picked.map((r) => r.id)).toEqual([2, 4, 5])
  })

  it('ranks compilations below artist albums unless they dominate', () => {
    const picked = pickTopReleases(
      [result({ id: 1, title: 'Various - Hits', community: { have: 250 } }), result({ id: 2, title: 'A - Album', community: { have: 100 } })],
      1,
    )
    expect(picked[0].id).toBe(2)
  })
})

describe('buildAttempts', () => {
  it('broadens a specific style worldwide, then falls back to a keyword search', () => {
    const attempts = buildAttempts(country(), genre({ style: 'Bossa Nova' }))
    expect(attempts).toEqual([
      { match: 'exact', params: { style: 'Bossa Nova', country: 'Brazil' } },
      { match: 'global', params: { style: 'Bossa Nova' } },
      { match: 'keyword', params: { q: 'Bossa Nova', country: 'Brazil' } },
    ])
  })

  it('never drops the country for generic styles', () => {
    const attempts = buildAttempts(country(), genre({ style: 'Folk', keepCountry: true, keyword: 'forró' }))
    expect(attempts.map((a) => a.match)).toEqual(['exact', 'keyword'])
    expect(attempts[1].params).toEqual({ q: 'forró', country: 'Brazil' })
  })

  it('searches every country when the genre opts out of the filter', () => {
    const attempts = buildAttempts(country(), genre({ q: 'Éthiopiques', country: null }, 'Éthiopiques'))
    expect(attempts).toEqual([{ match: 'exact', params: { q: 'Éthiopiques' } }])
  })
})

describe('searchReleases', () => {
  it('stops at the first search with enough records', async () => {
    const fetcher = vi.fn<SearchFetcher>().mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({
      results: [result({ id: 1, title: 'A - 1' }), result({ id: 2, title: 'B - 2' }), result({ id: 3, title: 'C - 3' })],
    })
    const outcome = await searchReleases(country(), genre({ style: 'Bossa Nova' }), fetcher)
    expect(outcome.match).toBe('global')
    expect(outcome.releases).toHaveLength(3)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(Object.fromEntries(fetcher.mock.calls[0][0])).toMatchObject({ type: 'master', style: 'Bossa Nova', country: 'Brazil' })
  })

  it('returns the best partial result when nothing has three', async () => {
    const fetcher = vi.fn<SearchFetcher>().mockResolvedValue({ results: [result({ id: 9, title: 'A - Only' })] })
    const outcome = await searchReleases(country(), genre({ style: 'Bossa Nova' }), fetcher)
    expect(outcome).toMatchObject({ match: 'exact', releases: [{ id: 9 }] })
  })
})
