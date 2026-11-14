import { describe, expect, it } from 'vitest'
import { neighbours } from './similarity'

const chart = (...keys: string[]) => keys.map((key, index) => [index + 1, key] as [number, string])

describe('neighbours', () => {
  const index = {
    updated: '',
    complete: true,
    charts: {
      HU: chart('a', 'b', 'c', 'd'),
      AT: chart('a', 'b', 'c', 'x'),
      SK: chart('a', 'y', 'z', 'w'),
      JP: chart('p', 'q', 'r', 's'),
    },
  }

  it('ranks countries by the share of songs their charts have in common', () => {
    expect(neighbours(index, 'HU')).toEqual([
      { iso2: 'AT', shared: 3, share: 0.75 },
      { iso2: 'SK', shared: 1, share: 0.25 },
      { iso2: 'JP', shared: 0, share: 0 },
    ])
  })

  it('is empty for a country without a chart', () => {
    expect(neighbours(index, 'XX')).toEqual([])
    expect(neighbours(undefined, 'HU')).toEqual([])
  })
})
