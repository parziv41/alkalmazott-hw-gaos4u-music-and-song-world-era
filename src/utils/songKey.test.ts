import { describe, expect, it } from 'vitest'
import { songKey as serverKey } from '../../api/charts.ts'
import { songKey } from './songKey'

const samples: [string, string][] = [
  ['KAROL G, Judeline & rusowsky', 'BbY WOW'],
  ['Ronisia', 'Cuenta (feat. Meryl & Shay)'],
  ['Marics Peti, KKevin & DZSINDZSER', 'CIA'],
  ['Beyoncé', 'Déjà Vu [Remastered]'],
  ['Tiakola feat. Jorja Smith', 'Jet Lag'],
]

describe('songKey', () => {
  it('ignores featured artists, bracketed versions, accents and punctuation', () => {
    expect(songKey('KAROL G, Judeline & rusowsky', 'BbY WOW')).toBe(songKey('KAROL G', 'BbY WOW'))
    expect(songKey('Ronisia', 'Cuenta (feat. Meryl & Shay)')).toBe(songKey('Ronisia', 'Cuenta'))
    expect(songKey('Beyoncé', 'Déjà Vu')).toBe('beyonce|dejavu')
  })

  it.each(samples)('matches the server for %s – %s', (artist, title) => {
    expect(songKey(artist, title)).toBe(serverKey(artist, title))
  })
})
