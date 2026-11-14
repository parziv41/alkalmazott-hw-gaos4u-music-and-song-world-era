import { createContext, use } from 'react'
import type { Preview } from '../types/charts'

/** What to play: either a chart track (Deezer id) or an artist's best-known track. */
export type PreviewRequest = {
  /** Identifies the row that asked, so it can show "playing". */
  key: string
  label: string
  params: { track: string } | { deezerArtist?: string; artist: string } | { artist: string; title: string }
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export type PlayerState = {
  status: PlayerStatus
  request: PreviewRequest | null
  preview: Preview | null
  progress: number
}

export type Player = PlayerState & {
  play: (request: PreviewRequest) => void
  toggle: () => void
  stop: () => void
}

export const PlayerContext = createContext<Player | null>(null)

export function usePlayer(): Player {
  const player = use(PlayerContext)
  if (!player) throw new Error('usePlayer needs a <PlayerProvider>')
  return player
}
