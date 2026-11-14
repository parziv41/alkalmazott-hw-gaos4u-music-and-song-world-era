import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { hu } from '../i18n/hu'
import { decadePoints, distancePoints, localHits, pick, scoreShare } from './quiz'
import { songKey } from './songKey'

describe('quiz scoring', () => {
  it('gives full points for the right country and fewer the further off', () => {
    expect(distancePoints(0)).toBe(1000)
    expect(distancePoints(250)).toBeGreaterThan(800)
    expect(distancePoints(1500)).toBe(368)
    expect(distancePoints(10_000)).toBeLessThan(5)
  })

  it('gives partial credit for nearby decades', () => {
    expect(decadePoints(1960, 1960)).toBe(1000)
    expect(decadePoints(1970, 1960)).toBe(600)
    expect(decadePoints(1940, 1960)).toBe(300)
    expect(decadePoints(1990, 1960)).toBe(0)
  })

  it('sums up a game in words', () => {
    expect(scoreShare(9000)).toBe(0.9)
    expect(en.quiz.verdict(scoreShare(9000))).toBe('World-class ears!')
    expect(en.quiz.verdict(scoreShare(1000))).toMatch(/listen around the world/)
    expect(hu.quiz.verdict(scoreShare(1000))).not.toBe(en.quiz.verdict(scoreShare(1000)))
  })
})

describe('localHits', () => {
  const track = (rank: number, artist: string, title: string, deezerId?: number) => ({ rank, artist, title, deezerId })
  const tracks = [track(1, 'Global Star', 'Everywhere', 1), track(2, 'Local Hero', 'Only Here', 2), track(3, 'No Preview', 'Silent')]
  const index = {
    updated: '',
    complete: true,
    charts: {
      HU: tracks.map((t) => [t.rank, songKey(t.artist, t.title)] as [number, string]),
      AT: [[1, songKey('Global Star', 'Everywhere')]] as [number, string][],
      DE: [[3, songKey('Global Star', 'Everywhere')]] as [number, string][],
    },
  }

  it('keeps playable songs that chart in at most one other country', () => {
    expect(localHits(tracks, index, 'HU').map((t) => t.title)).toEqual(['Only Here'])
  })

  it('accepts any playable song while the index is missing', () => {
    expect(localHits(tracks, undefined, 'HU').map((t) => t.title)).toEqual(['Everywhere', 'Only Here'])
  })
})

describe('pick', () => {
  it('avoids what was already used while it can', () => {
    for (let i = 0; i < 20; i++) expect(pick(['a', 'b'], new Set(['a']))).toBe('b')
    expect(pick(['a'], new Set(['a']))).toBe('a')
    expect(pick([])).toBeUndefined()
  })
})
