import { describe, expect, it } from 'vitest'
import { chartPositions } from './useChart'

describe('chartPositions', () => {
  it('lists the countries where a song is charting, best rank first', () => {
    const index = {
      updated: '',
      complete: true,
      charts: {
        HU: [
          [1, 'maricspeti|cia'],
          [2, 'other|song'],
        ] as [number, string][],
        AT: [[7, 'maricspeti|cia']] as [number, string][],
        FR: [[1, 'ninho|despiges']] as [number, string][],
      },
    }
    expect(chartPositions(index, 'maricspeti|cia')).toEqual([
      { iso2: 'HU', rank: 1 },
      { iso2: 'AT', rank: 7 },
    ])
    expect(chartPositions(index, 'nobody|nothing')).toEqual([])
    expect(chartPositions(undefined, 'maricspeti|cia')).toEqual([])
  })
})
