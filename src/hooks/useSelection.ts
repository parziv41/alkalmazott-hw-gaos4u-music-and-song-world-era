import { useCallback, useEffect, useState } from 'react'

/** `view=top100` opens the global chart when no country is selected; `view=alltime` the all-time Top 30. */
export type View = 'top100' | 'alltime'
/** `place` is a town or village from the gazetteer, for places that have no music data of their own. */
type SelectionState = { country: string | null; city: string | null; place: string | null; genre: string | null; view: View | null }
const KEYS = ['country', 'city', 'place', 'genre', 'view'] as const

function readUrl(): SelectionState {
  const params = new URLSearchParams(window.location.search)
  return {
    country: params.get('country')?.toLowerCase() ?? null,
    city: params.get('city'),
    place: params.get('place'),
    genre: params.get('genre'),
    view: params.get('view') === 'top100' ? 'top100' : params.get('view') === 'alltime' ? 'alltime' : null,
  }
}

function writeUrl(next: SelectionState, mode: 'push' | 'replace') {
  const params = new URLSearchParams(window.location.search)
  for (const key of KEYS) {
    const value = next[key]
    if (value) params.set(key, value)
    else params.delete(key)
  }
  const search = params.toString()
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  if (mode === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

/**
 * The URL is the single source of truth for what's selected (`?country=fr&city=Q90`,
 * `?country=br&genre=bossa-nova`), so links are shareable and Back steps out of a city, then the panel.
 */
export function useSelection() {
  const [state, setState] = useState(readUrl)

  useEffect(() => {
    const onPopState = () => setState(readUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // A new country or city adds a history entry; switching genre replaces it.
  const select = useCallback(
    (country: string, { city = null, place = null, genre = null }: { city?: string | null; place?: string | null; genre?: string | null } = {}) => {
      const current = readUrl()
      const next = { country: country.toLowerCase(), city, place, genre, view: null }
      const same = current.country === next.country && current.city === next.city && current.place === next.place
      writeUrl(next, same ? 'replace' : 'push')
      setState(next)
    },
    [],
  )

  const clear = useCallback(() => {
    const current = readUrl()
    if (!current.country && !current.view) return
    const next = { country: null, city: null, place: null, genre: null, view: null }
    writeUrl(next, 'push')
    setState(next)
  }, [])

  const showView = useCallback((view: View) => {
    const next = { country: null, city: null, place: null, genre: null, view }
    writeUrl(next, 'push')
    setState(next)
  }, [])

  return { ...state, select, clear, showView }
}
