import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { hu } from '../i18n/hu'
import { inDecade } from './useTimeline'

describe('decades', () => {
  it('labels decades, and the first stop as everything before 1850', () => {
    expect(en.decade.label(1960)).toBe('1960s')
    expect(en.decade.label(1840)).toBe('Before 1850')
    expect(hu.decade.label(1960)).toBe('1960-as évek')
    expect(hu.decade.label(1970)).toBe('1970-es évek')
    expect(hu.decade.label(1840)).toBe('1850 előtt')
    expect(hu.decade.inThe(1950)).toBe('az 1950-es években')
  })

  it('puts years in their decade', () => {
    expect(inDecade(1969, 1960)).toBe(true)
    expect(inDecade(1970, 1960)).toBe(false)
    expect(inDecade(1811, 1840)).toBe(true) // Liszt
    expect(inDecade(1850, 1840)).toBe(false)
    expect(inDecade(undefined, 1960)).toBe(false)
  })
})
