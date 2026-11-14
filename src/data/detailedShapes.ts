// Higher-resolution (1:50m) outlines: the only shapes for small island states, and what the globe
// draws once it is zoomed in. ~236 KB gzipped, so fetched once the browser is idle rather than bundled.
import detailedUrl from 'world-atlas/countries-50m.json?url'
import { buildAtlas, type Atlas, type WorldTopology } from './atlas'

let request: Promise<Atlas> | undefined

export function loadDetailedAtlas(): Promise<Atlas> {
  request ??= fetch(detailedUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load detailed map shapes (${response.status})`)
      return response.json() as Promise<WorldTopology>
    })
    .then(buildAtlas)
    .catch((error: unknown) => {
      request = undefined // allow a later retry
      throw error
    })
  return request
}

export function prefetchDetailedAtlas(onLoad: (atlas: Atlas) => void): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1200))
  // Even with Save-Data on, load when it's needed: the camera asks again once someone zooms in.
  if (connection?.saveData) return
  idle(() => void loadDetailedAtlas().then(onLoad, () => {}))
}
