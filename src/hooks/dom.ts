import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Size } from '../utils/globe'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

/** Live pixel size of an element, via ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const width = Math.round(element.clientWidth)
      const height = Math.round(element.clientHeight)
      setSize((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

export function useViewportHeight(): number {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('resize', onChange)
      return () => window.removeEventListener('resize', onChange)
    },
    () => window.innerHeight,
    () => 800,
  )
}

/** True only once `active` has stayed true for `delay` ms, so fast (cached) loads never flash a spinner. */
export function useDelayedFlag(active: boolean, delay: number): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setElapsed(true), delay)
    return () => {
      clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, delay])
  return active && elapsed
}

type HotkeyHandlers = { onSearch: () => void; onEscape: () => void; onHelp: () => void }

export function useHotkeys(handlers: HotkeyHandlers) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        handlersRef.current.onSearch()
        return
      }
      if (typing || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === '/') {
        event.preventDefault()
        handlersRef.current.onSearch()
      } else if (event.key === '?') {
        handlersRef.current.onHelp()
      } else if (event.key === 'Escape') {
        handlersRef.current.onEscape()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
