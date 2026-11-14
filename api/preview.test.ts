import { describe, expect, it } from 'vitest'
import { pickSong } from './preview.ts'

const track = (artist: string, title: string, preview = 'https://cdn/p.mp3') => ({ id: 1, title, preview, artist: { name: artist } })

describe('pickSong', () => {
  it('finds the song by its title and artist, ignoring accents and remaster notes', () => {
    const found = pickSong([track('Someone Else', 'Kleine Annabell'), track('Ronny', 'Kleine Annabell (Remastered 2004)')], 'Ronny', 'Kleine Annabell')
    expect(found?.artist.name).toBe('Ronny')
    expect(pickSong([track('Kovács Kati', 'Nem leszek a játékszered')], 'Kovacs Kati', 'Nem leszek a jatekszered')).not.toBeNull()
    // Family name first on Wikipedia, given name first on Deezer.
    expect(pickSong([track('Kati Kovács', 'Nem leszek a játékszered')], 'Kovács Kati', 'Nem leszek a játékszered')).not.toBeNull()
  })

  it('takes the lead artist and the first side of a double A-side', () => {
    expect(pickSong([track('The Beatles', 'Rock And Roll Music')], 'The Beatles', 'Rock and Roll Music / No Reply')).not.toBeNull()
    expect(pickSong([track('Santo & Johnny', 'And I Love Her')], 'Santo & Johnny', 'And I Love Her')).not.toBeNull()
  })

  it('rejects other songs and songs without a preview', () => {
    expect(pickSong([track('Ronny', 'Oh My Darling Caroline')], 'Ronny', 'Kleine Annabell')).toBeNull()
    expect(pickSong([track('Ronny', 'Kleine Annabell', '')], 'Ronny', 'Kleine Annabell')).toBeNull()
  })
})
