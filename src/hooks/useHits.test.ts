import { describe, expect, it } from 'vitest'
import { hitDecades, wikipediaUrl } from './useHits'

describe('hits helpers', () => {
  it('lists the decades a country has number ones in', () => {
    expect(hitDecades([1966, 1967, 2002, 2003, 2011])).toEqual([1960, 2000, 2010])
  })

  it('links a page on the right Wikipedia', () => {
    expect(wikipediaUrl('en:List of number-one hits of 1965 (Germany)')).toBe('https://en.wikipedia.org/wiki/List_of_number-one_hits_of_1965_(Germany)')
    expect(wikipediaUrl('hu:Táncdalfesztivál ’66')).toBe('https://hu.wikipedia.org/wiki/T%C3%A1ncdalfesztiv%C3%A1l_%E2%80%9966')
  })
})
