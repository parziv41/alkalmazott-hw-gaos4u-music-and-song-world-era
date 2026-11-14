import { describe, expect, it } from 'vitest'
import { isSameTrack, leadArtist, normalize, parseCsvLine } from './charts.ts'

describe('parseCsvLine', () => {
  it('reads quoted cells with commas and escaped quotes', () => {
    expect(parseCsvLine('1,"KAROL G, Judeline & rusowsky","BbY ""WOW"""')).toEqual(['1', 'KAROL G, Judeline & rusowsky', 'BbY "WOW"'])
  })
})

describe('Deezer matching', () => {
  const track = (artist: string, title: string) => ({ id: 1, title, artist: { name: artist } })

  it('takes the lead artist from a credit list', () => {
    expect(leadArtist('KAROL G, Judeline & rusowsky')).toBe('KAROL G')
    expect(leadArtist('Tiakola feat. Jorja Smith')).toBe('Tiakola')
  })

  it('ignores accents, case and punctuation', () => {
    expect(normalize("Shotta's.")).toBe('shottas')
    expect(normalize('Beszorult Mondat')).toBe(normalize('beszorult mondat'))
  })

  it('accepts the same song and rejects a different artist', () => {
    expect(isSameTrack(track('Ninho', 'DES PIGES'), 'Ninho', 'DES PIGES')).toBe(true)
    expect(isSameTrack(track('Ronisia', 'Cuenta'), 'Ronisia', 'Cuenta (feat. Meryl & Shay)')).toBe(true)
    expect(isSameTrack(track('Desert Niños', 'A Mis Pies'), 'Ninho', 'DES PIGES')).toBe(false)
  })
})
