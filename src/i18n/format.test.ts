import { describe, expect, it } from 'vitest'
import { huArticle, huDecade } from './format'

describe('Hungarian decades', () => {
  it.each([
    [1900, '1900-as'],
    [1910, '1910-es'],
    [1920, '1920-as'],
    [1940, '1940-es'],
    [1960, '1960-as'],
    [1970, '1970-es'],
    [1980, '1980-as'],
    [1990, '1990-es'],
    [2000, '2000-es'],
    [2010, '2010-es'],
    [2020, '2020-as'],
    [1850, '1850-es'],
  ])('%i → %s', (decade, label) => {
    expect(huDecade(decade)).toBe(label)
  })

  it('picks the article by how the number is read', () => {
    expect(huArticle(1970)).toBe('az')
    expect(huArticle(2000)).toBe('a')
    expect(huArticle(5)).toBe('az')
    expect(huArticle(3)).toBe('a')
  })
})
