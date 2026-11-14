import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { Timeline } from '../types/places'

/** Counts and centres of gravity per decade (public/data/timeline.json, ~20 KB). */
export function useTimeline(enabled: boolean) {
  return useQuery({
    queryKey: ['timeline'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/data/timeline.json', { signal })
      if (!response.ok) throw new Error(`Could not load the timeline (${response.status})`)
      return (await response.json()) as Timeline
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Whether a birth or release year falls into a time-machine stop (1840 collects everything earlier). */
export const inDecade = (year: number | undefined, decade: number) =>
  year !== undefined && (decade < 1850 ? year < 1850 : year >= decade && year < decade + 10)

function readDecade(): number | null {
  const value = Number(new URLSearchParams(window.location.search).get('decade'))
  return Number.isInteger(value) && value >= 1840 && value <= 2020 && value % 10 === 0 ? value : null
}

/**
 * The time machine's decade, kept in the URL (`?decade=1960`) so a view can be shared. Replaces
 * the history entry rather than adding one, so dragging the slider doesn't flood Back.
 */
export function useDecade() {
  const [decade, setState] = useState(readDecade)

  useEffect(() => {
    const onPopState = () => setState(readDecade())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setDecade = useCallback((next: number | null) => {
    const params = new URLSearchParams(window.location.search)
    if (next === null) params.delete('decade')
    else params.set('decade', String(next))
    const search = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`)
    setState(next)
  }, [])

  return [decade, setDecade] as const
}
