import { createContext, use } from 'react'

/** A song someone asked "where else is this charting?" about. */
export type SpotlightTrack = { title: string; artist: string; artwork?: string }

/** Opens the song spotlight from any chart row, without passing callbacks down every panel. */
export const SpotlightContext = createContext<(track: SpotlightTrack) => void>(() => {})

export const useSpotlight = () => use(SpotlightContext)
