import { describe, expect, it } from 'vitest'
import type { IndexedSong } from '../types/hits'
import { anySongKey, leadArtist, nameKey, prepareHits, searchHits } from './hitSearch'

const index: IndexedSong[] = [
  ['Yesterday', 'The Beatles', [['NL', 1965, 3], ['US', 1965, 4], ['ES', 1966, 2]]],
  ['(I Can’t Get No) Satisfaction', 'The Rolling Stones', [['US', 1965, 4], ['DE', 1965, 6]]],
  ['Help!', 'The Beatles', [['GB', 1965, 3]]],
  ['Yesterday Man', 'Chris Andrews', [['IE', 1965, 2]]],
  ['Nem leszek a játékszered', 'Kovács Kati', [['HU', 1966, 0]]],
  ['Uptown Funk', 'Mark Ronson featuring Bruno Mars', [['GB', 2015, 6], ['US', 2015, 14]]],
]

describe('anySongKey', () => {
  it('brings one song’s spellings together', () => {
    expect(anySongKey('(I Can’t Get No) Satisfaction', 'The Rolling Stones')).toBe(anySongKey('Satisfaction', 'Rolling Stones'))
    expect(anySongKey('Hound Dog / Don’t Be Cruel', 'Elvis Presley')).toBe(anySongKey('Don’t Be Cruel / Hound Dog', 'Elvis Presley with The Jordanaires'))
    expect(anySongKey('Yesterday', 'The Beatles')).not.toBe(anySongKey('Yesterday Man', 'Chris Andrews'))
  })

  it('takes the lead artist from a credit', () => {
    expect(leadArtist('Mark Ronson featuring Bruno Mars')).toBe('Mark Ronson')
    expect(leadArtist('Simon & Garfunkel')).toBe('Simon')
  })
})

describe('searchHits', () => {
  const prepared = prepareHits(index)

  it('finds songs by title, starts first, then the most widespread', () => {
    expect(searchHits(prepared, 'yester').songs.map((song) => song.title)).toEqual(['Yesterday', 'Yesterday Man'])
    // Accents and punctuation don't matter.
    expect(searchHits(prepared, 'jatekszered').songs[0].artist).toBe('Kovács Kati')
    expect(searchHits(prepared, 'satisfaction').songs[0]).toMatchObject({ first: 1965, countries: 2 })
  })

  it('finds artists with all their number ones, under their lead name', () => {
    const [beatles] = searchHits(prepared, 'beatles').artists
    expect(beatles.name).toBe('The Beatles')
    expect(beatles.songs.map((song) => song.title)).toEqual(['Yesterday', 'Help!'])
    expect(beatles).toMatchObject({ countries: 4, first: 1965, last: 1966 })
    expect(searchHits(prepared, 'ronson').artists[0].name).toBe('Mark Ronson')
  })

  it('finds an artist’s number ones whichever order the name is written in', () => {
    expect(nameKey('Kovács Kati')).toBe(nameKey('Kati Kovács'))
    expect(nameKey('The Beatles')).toBe(nameKey('Beatles'))
    expect(nameKey('"The Beatles"')).toBe(nameKey('Beatles'))
    expect(prepared.byName.get(nameKey('Kati Kovács'))?.songs[0].title).toBe('Nem leszek a játékszered')
  })

  it('tells whether a song found elsewhere was a number one, however it is spelled', () => {
    expect(prepared.byKey.get(anySongKey('Satisfaction', 'Rolling Stones'))?.entries).toHaveLength(2)
    expect(prepared.byKey.get(anySongKey('Gyöngyhajú lány', 'Omega'))).toBeUndefined()
  })

  it('needs at least two letters', () => {
    expect(searchHits(prepared, 'y')).toEqual({ songs: [], artists: [] })
  })
})
