import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PlayerContext, type Player, type PlayerState, type PreviewRequest } from '../../hooks/usePlayer'
import type { Preview } from '../../types/charts'

const IDLE: PlayerState = { status: 'idle', request: null, preview: null, progress: 0 }

/** One shared <audio> for 30-second previews: starting a new one stops the last. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)
  const [state, setState] = useState<PlayerState>(IDLE)

  const audio = useCallback(() => {
    if (!audioRef.current) {
      const element = new Audio()
      element.preload = 'auto'
      element.volume = 0.85
      element.addEventListener('timeupdate', () =>
        setState((s) => ({ ...s, progress: element.duration ? element.currentTime / element.duration : 0 })),
      )
      element.addEventListener('playing', () => setState((s) => ({ ...s, status: 'playing' })))
      element.addEventListener('pause', () => setState((s) => (s.status === 'playing' ? { ...s, status: 'paused' } : s)))
      element.addEventListener('ended', () => setState((s) => ({ ...s, status: 'paused', progress: 1 })))
      element.addEventListener('error', () => setState((s) => (s.request ? { ...s, status: 'error' } : s)))
      audioRef.current = element
    }
    return audioRef.current
  }, [])

  const stop = useCallback(() => {
    tokenRef.current++
    audioRef.current?.pause()
    setState(IDLE)
  }, [])

  const play = useCallback(
    (request: PreviewRequest) => {
      const element = audio()
      const token = ++tokenRef.current
      element.pause()
      setState({ status: 'loading', request, preview: null, progress: 0 })
      fetch(`/api/preview?${new URLSearchParams(request.params as Record<string, string>)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Preview ${response.status}`)
          return (await response.json()) as Preview
        })
        .then((preview) => {
          if (token !== tokenRef.current) return
          setState((s) => ({ ...s, preview }))
          element.src = preview.preview
          return element.play()
        })
        .catch(() => {
          if (token === tokenRef.current) setState((s) => ({ ...s, status: 'error' }))
        })
    },
    [audio],
  )

  const toggle = useCallback(() => {
    const element = audioRef.current
    if (!element || !state.preview) return
    if (element.paused) {
      if (element.ended) element.currentTime = 0
      void element.play().catch(() => setState((s) => ({ ...s, status: 'error' })))
    } else element.pause()
  }, [state.preview])

  // Errors clear themselves after a moment.
  useEffect(() => {
    if (state.status !== 'error') return
    const timer = window.setTimeout(() => setState((s) => (s.status === 'error' ? IDLE : s)), 3200)
    return () => window.clearTimeout(timer)
  }, [state.status])

  useEffect(() => () => audioRef.current?.pause(), [])

  const value = useMemo<Player>(() => ({ ...state, play, toggle, stop }), [state, play, toggle, stop])
  return <PlayerContext value={value}>{children}</PlayerContext>
}
