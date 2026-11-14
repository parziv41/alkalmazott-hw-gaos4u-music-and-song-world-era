import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { countries } from '../data'
import type { Preview } from '../types/charts'
import type { Country } from '../types/music'
import type { Artist } from '../types/places'
import { nationalPlaces } from '../utils/chartPlaces'
import { readNumber, writeNumber } from '../utils/misc'
import { decadePoints, distancePoints, localHits, pick, ROUNDS } from '../utils/quiz'
import { distanceKm } from '../utils/settlements'
import { chartIndexQuery, chartQuery } from './useChart'
import { usePlayer } from './usePlayer'
import { placesQuery } from './usePlaces'

/** "Where?": which country's chart is this hit from. "When?": which decade was this artist born or formed in. */
export type QuizMode = 'where' | 'when'

export type QuizAnswer = { country: Country; title: string; artist: string; artwork?: string; decade?: number; year?: number }
export type QuizRound = {
  answer: QuizAnswer
  guess?: { country?: Country; decade?: number; km?: number }
  points: number
}
export type QuizStatus = 'intro' | 'loading' | 'playing' | 'revealed' | 'finished' | 'error'

const ATTEMPTS = 8
const bestKey = (mode: QuizMode) => `gmm:quiz-best-${mode}`

// "When?" asks about artists born or formed in 1900–2009, from countries with enough of them.
const artistCountries = countries.filter((country) => country.artistCount >= 30)
const isAskable = (artist: Artist) => !!artist.year && artist.year >= 1900 && artist.year < 2010

async function fetchPreview(params: Record<string, string>): Promise<Preview> {
  const response = await fetch(`/api/preview?${new URLSearchParams(params)}`)
  if (!response.ok) throw new Error(`Preview ${response.status}`)
  return (await response.json()) as Preview
}

/**
 * The "Where's it from?" game. Songs play from the quiz's own <audio>, so the preview player
 * (which shows the title) never gives the answer away.
 */
export function useQuiz() {
  const queryClient = useQueryClient()
  const player = usePlayer()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const token = useRef(0)
  const used = useRef(new Set<string>())
  const [mode, setMode] = useState<QuizMode>('where')
  const [status, setStatus] = useState<QuizStatus>('intro')
  const [rounds, setRounds] = useState<QuizRound[]>([])
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [best, setBest] = useState(() => ({ where: readNumber(bestKey('where')), when: readNumber(bestKey('when')) }))

  const audio = useCallback(() => {
    if (!audioRef.current) {
      const element = new Audio()
      element.volume = 0.85
      element.addEventListener('timeupdate', () => setProgress(element.duration ? element.currentTime / element.duration : 0))
      element.addEventListener('play', () => setPlaying(true))
      element.addEventListener('pause', () => setPlaying(false))
      audioRef.current = element
    }
    return audioRef.current
  }, [])

  const current = rounds.at(-1) ?? null
  const total = rounds.reduce((sum, round) => sum + round.points, 0)

  /** A local hit from a random country's chart: in that chart and at most one other. */
  const whereRound = useCallback(async (): Promise<{ answer: QuizAnswer; preview: Preview } | null> => {
    const index = queryClient.getQueryData(chartIndexQuery().queryKey)
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const place = pick(nationalPlaces, new Set(nationalPlaces.filter((p) => used.current.has(p.iso2))))
      if (!place) return null
      used.current.add(place.iso2)
      const country = countries.find((c) => c.iso2 === place.iso2)
      try {
        const chart = await queryClient.fetchQuery(chartQuery(place.target.params))
        const track = pick(localHits(chart.tracks.slice(0, 25), index, place.iso2))
        if (!country || !track?.deezerId) continue
        const preview = await fetchPreview({ track: String(track.deezerId) })
        return { answer: { country, title: track.title, artist: track.artist, artwork: track.artwork ?? preview.cover }, preview }
      } catch {
        // That chart or preview isn't available right now: try another country.
      }
    }
    return null
  }, [queryClient])

  /** One of a random country's best-known artists born or formed since 1900, and their top track. */
  const whenRound = useCallback(async (): Promise<{ answer: QuizAnswer; preview: Preview } | null> => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const country = pick(artistCountries, new Set(artistCountries.filter((c) => used.current.has(c.iso2))))
      if (!country) return null
      used.current.add(country.iso2)
      try {
        const places = await queryClient.fetchQuery(placesQuery(country.iso2))
        const artists = [...new Map(places.cities.flatMap((city) => city.artists.filter(isAskable)).map((a) => [a.id, a])).values()]
          .sort((a, b) => b.sl - a.sl)
          .slice(0, 40)
        const artist = pick(artists)
        if (!artist?.year) continue
        const preview = await fetchPreview(artist.deezer ? { deezerArtist: String(artist.deezer), artist: artist.name } : { artist: artist.name })
        const decade = Math.floor(artist.year / 10) * 10
        return { answer: { country, title: preview.title, artist: artist.name, artwork: preview.cover, decade, year: artist.year }, preview }
      } catch {
        // No preview for that artist: try another country.
      }
    }
    return null
  }, [queryClient])

  const nextRound = useCallback(
    async (game: QuizMode) => {
      const ticket = ++token.current
      setStatus('loading')
      setProgress(0)
      const round = await (game === 'where' ? whereRound() : whenRound())
      if (ticket !== token.current) return
      if (!round) {
        setStatus('error')
        return
      }
      setRounds((list) => [...list, { answer: round.answer, points: 0 }])
      setStatus('playing')
      const element = audio()
      element.src = round.preview.preview
      void element.play().catch(() => setPlaying(false))
    },
    [audio, whereRound, whenRound],
  )

  const start = useCallback(
    (game: QuizMode) => {
      player.stop()
      used.current = new Set()
      setMode(game)
      setRounds([])
      // Picking local hits needs every country's chart; fetch it alongside the first rounds.
      if (game === 'where') void queryClient.prefetchQuery(chartIndexQuery())
      void nextRound(game)
    },
    [player, queryClient, nextRound],
  )

  const reveal = useCallback((guess: QuizRound['guess'], points: number) => {
    setRounds((list) => list.map((round, index) => (index === list.length - 1 ? { ...round, guess, points } : round)))
    setStatus('revealed')
  }, [])

  const guessCountry = useCallback(
    (country: Country) => {
      if (status !== 'playing' || mode !== 'where' || !current) return
      const target = current.answer.country
      const km = country.id === target.id ? 0 : distanceKm({ lon: country.center[0], lat: country.center[1] }, { lon: target.center[0], lat: target.center[1] })
      reveal({ country, km }, distancePoints(km))
    },
    [status, mode, current, reveal],
  )

  const guessDecade = useCallback(
    (decade: number) => {
      if (status !== 'playing' || mode !== 'when' || current?.answer.decade === undefined) return
      reveal({ decade }, decadePoints(decade, current.answer.decade))
    },
    [status, mode, current, reveal],
  )

  const skip = useCallback(() => {
    if (status === 'playing') reveal(undefined, 0)
  }, [status, reveal])

  const next = useCallback(() => {
    if (rounds.length < ROUNDS) {
      void nextRound(mode)
      return
    }
    audioRef.current?.pause()
    setStatus('finished')
    if (total > best[mode]) {
      writeNumber(bestKey(mode), total)
      setBest((value) => ({ ...value, [mode]: total }))
    }
  }, [rounds.length, mode, nextRound, total, best])

  const togglePlay = useCallback(() => {
    const element = audioRef.current
    if (!element?.src) return
    if (element.paused) void element.play().catch(() => {})
    else element.pause()
  }, [])

  const stop = useCallback(() => {
    token.current++
    audioRef.current?.pause()
    setStatus('intro')
    setRounds([])
  }, [])

  useEffect(() => () => audioRef.current?.pause(), [])

  return { mode, status, rounds, current, total, best, playing, progress, start, guessCountry, guessDecade, skip, next, togglePlay, stop }
}

export type Quiz = ReturnType<typeof useQuiz>
