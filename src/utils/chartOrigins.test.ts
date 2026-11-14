import { describe, expect, it } from 'vitest'
import { originCounts } from './chartOrigins'

describe('originCounts', () => {
  it('counts songs per artist country, most first, ignoring unknown ones', () => {
    const track = (rank: number, origin?: string) => ({ rank, title: 't', artist: 'a', origin })
    const counts = originCounts([track(1, 'US'), track(2, 'GB'), track(3, 'US'), track(4), track(5, 'ZZ')])
    expect(counts.map(({ country, count }) => [country.iso2, count])).toEqual([
      ['US', 2],
      ['GB', 1],
    ])
  })
})
