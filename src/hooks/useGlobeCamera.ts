import { easeCubicInOut, easeCubicOut } from 'd3-ease'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { clamp, interpolateView, rotateBy, zoomAt, type Size, type View } from '../utils/globe'

export type GlobeCamera = {
  view: () => View
  /** Jump straight to a view. */
  set: (view: View) => void
  flyTo: (view: View, options?: { delay?: number; duration?: number; ease?: (t: number) => number }) => void
  zoomBy: (factor: number, point?: [number, number]) => void
  rotate: (dx: number, dy: number) => void
  /** Slow idle spin, until the first interaction. */
  autoRotate: (on: boolean) => void
  /** Whether the camera is moving: a frame is coming, or one was drawn a moment ago (a drag between moves). */
  isMoving: () => boolean
}

type Options = {
  /** The element that receives drags, wheel and pinch: the globe and the city markers over it. */
  targetRef: RefObject<HTMLElement | null>
  radius: number
  size: Size | null
  reducedMotion: boolean
  initialView: () => View
  /** Called at most once per animation frame with the view to draw. */
  onFrame: (view: View) => void
  /** Called when someone grabs, scrolls or pinches the globe. */
  onInteract: () => void
}

const DRAG_THRESHOLD_PX = 5
const FRICTION_MS = 420 // inertia decays by 1/e over this time
const AUTO_ROTATE_DEG_PER_MS = 0.0035
// The idle spin redraws the whole globe: 25 frames a second (a pixel a frame) look the same and cost
// half, and after a minute nobody is watching any more.
const AUTO_ROTATE_FRAME_MS = 40
const AUTO_ROTATE_MAX_MS = 60_000
const WHEEL_SENSITIVITY = 0.0022

type Sample = { t: number; x: number; y: number }
type Gesture =
  | { kind: 'drag'; id: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean; samples: Sample[] }
  | { kind: 'pinch'; distance: number; midX: number; midY: number }

/**
 * The globe's camera: drag to spin it (with inertia, like a real globe), wheel or pinch to zoom
 * towards the cursor, and animated flights between countries. Views are written to the DOM
 * through `onFrame`, so none of this re-renders React.
 */
export function useGlobeCamera({ targetRef, radius, size, reducedMotion, initialView, onFrame, onInteract }: Options): GlobeCamera {
  const viewRef = useRef<View | null>(null)
  const frameRef = useRef(0)
  const motionRef = useRef<{ step: (now: number) => boolean } | null>(null)
  const autoRef = useRef(false)
  // The latest props, for the long-lived handlers below.
  const live = useRef({ radius, size, reducedMotion, initialView, onFrame, onInteract })
  useEffect(() => {
    live.current = { radius, size, reducedMotion, initialView, onFrame, onInteract }
  })

  const { camera, engine } = useMemo(() => {
    const current = () => (viewRef.current ??= live.current.initialView())

    const schedule = () => {
      if (frameRef.current) return
      frameRef.current = requestAnimationFrame(tick)
    }
    let lastTick = 0
    let lastFrame = 0
    let spinSince = 0
    const tick = (now: number) => {
      frameRef.current = 0
      const motion = motionRef.current
      if (motion && !motion.step(now)) motionRef.current = null
      if (!motionRef.current && autoRef.current) {
        spinSince ||= now
        if (now - spinSince > AUTO_ROTATE_MAX_MS) autoRef.current = false
        else if (now - lastTick < AUTO_ROTATE_FRAME_MS) {
          schedule()
          return
        } else {
          const dt = lastTick ? Math.min(now - lastTick, 64) : 16
          viewRef.current = { ...current(), lon: wrap(current().lon - AUTO_ROTATE_DEG_PER_MS * dt) }
        }
      } else spinSince = 0
      lastTick = now
      lastFrame = now
      live.current.onFrame(current())
      if (motionRef.current || autoRef.current) schedule()
    }

    const set = (view: View) => {
      viewRef.current = view
      schedule()
    }

    const run = (step: (now: number) => boolean) => {
      motionRef.current = { step }
      schedule()
    }

    const camera: GlobeCamera = {
      view: current,
      set(view) {
        motionRef.current = null
        set(view)
      },
      flyTo(target, { delay = 0, duration, ease = easeCubicInOut } = {}) {
        if (live.current.reducedMotion) {
          motionRef.current = null
          set(target)
          return
        }
        const flight = interpolateView(current(), target)
        const total = duration ?? flight.duration
        let start = 0
        run((now) => {
          start ||= now + delay
          const t = clamp((now - start) / total, 0, 1)
          viewRef.current = flight.at(ease(t))
          return t < 1
        })
      },
      zoomBy(factor, point) {
        const { radius: r, size: s, reducedMotion: reduced } = live.current
        if (!s) return
        const from = current()
        const target = zoomAt(from, factor, point ?? [from.x, from.y], r, s)
        if (reduced) return set(target)
        let start = 0
        run((now) => {
          start ||= now
          const t = clamp((now - start) / 320, 0, 1)
          const e = easeCubicOut(t)
          viewRef.current = { ...target, lon: lerpLon(from.lon, target.lon, e), lat: from.lat + (target.lat - from.lat) * e, k: from.k * (target.k / from.k) ** e }
          return t < 1
        })
      },
      rotate(dx, dy) {
        motionRef.current = null
        set(rotateBy(current(), dx, dy, live.current.radius))
      },
      autoRotate(on) {
        autoRef.current = on && !live.current.reducedMotion
        if (autoRef.current) schedule()
      },
      isMoving: () => frameRef.current !== 0 || performance.now() - lastFrame < 100,
    }
    return { camera, engine: { set, run } }
  }, [])

  // Pointer, wheel and pinch input.
  useEffect(() => {
    const stage = targetRef.current
    if (!stage) return
    const pointers = new Map<number, { x: number; y: number }>()
    let gesture: Gesture | null = null
    let suppressClick = false

    const local = (event: PointerEvent | WheelEvent): [number, number] => {
      const rect = stage.getBoundingClientRect()
      return [event.clientX - rect.left, event.clientY - rect.top]
    }
    const interrupt = () => {
      motionRef.current = null
      autoRef.current = false
      live.current.onInteract()
    }
    const startPinch = () => {
      const [a, b] = [...pointers.values()]
      gesture = { kind: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      interrupt()
      const [x, y] = local(event)
      pointers.set(event.pointerId, { x, y })
      if (pointers.size === 1) {
        gesture = { kind: 'drag', id: event.pointerId, startX: x, startY: y, lastX: x, lastY: y, moved: false, samples: [{ t: event.timeStamp, x, y }] }
      } else if (pointers.size === 2) {
        for (const id of pointers.keys()) if (!stage.hasPointerCapture(id)) stage.setPointerCapture(id)
        startPinch()
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId)
      if (!pointer || !gesture) return
      const [x, y] = local(event)
      pointer.x = x
      pointer.y = y
      const { radius: r, size: s } = live.current
      if (gesture.kind === 'drag' && gesture.id === event.pointerId) {
        if (!gesture.moved) {
          if (Math.hypot(x - gesture.startX, y - gesture.startY) < DRAG_THRESHOLD_PX) return
          // Capture only once it's a drag, so a plain click still lands on the country underneath.
          gesture.moved = true
          stage.setPointerCapture(event.pointerId)
          stage.classList.add('is-dragging')
        }
        engine.set(rotateBy(camera.view(), x - gesture.lastX, y - gesture.lastY, r))
        gesture.lastX = x
        gesture.lastY = y
        gesture.samples.push({ t: event.timeStamp, x, y })
        while (gesture.samples.length > 2 && event.timeStamp - gesture.samples[0].t > 100) gesture.samples.shift()
      } else if (gesture.kind === 'pinch' && pointers.size >= 2 && s) {
        const [a, b] = [...pointers.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        let view = rotateBy(camera.view(), midX - gesture.midX, midY - gesture.midY, r)
        view = zoomAt(view, distance / Math.max(gesture.distance, 1), [midX, midY], r, s)
        Object.assign(gesture, { distance, midX, midY })
        engine.set(view)
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      stage.classList.remove('is-dragging')
      if (gesture?.kind === 'pinch') {
        suppressClick = true
        // Lifting one finger of a pinch continues as a drag with the other.
        const rest = [...pointers.entries()][0]
        gesture = rest
          ? { kind: 'drag', id: rest[0], startX: rest[1].x, startY: rest[1].y, lastX: rest[1].x, lastY: rest[1].y, moved: true, samples: [] }
          : null
        return
      }
      if (gesture?.kind !== 'drag' || gesture.id !== event.pointerId) return
      const { moved, samples } = gesture
      gesture = null
      if (!moved) return
      suppressClick = true
      // Fling: keep spinning with the release velocity, slowing down like a globe on its axis.
      const first = samples[0]
      const last = samples.at(-1)
      if (!first || !last || live.current.reducedMotion || event.timeStamp - last.t > 80) return
      const dt = Math.max(last.t - first.t, 1)
      let vx = (last.x - first.x) / dt
      let vy = (last.y - first.y) / dt
      if (Math.hypot(vx, vy) < 0.15) return
      let previous = 0
      engine.run((now) => {
        const elapsed = previous ? Math.min(now - previous, 48) : 16
        previous = now
        viewRef.current = rotateBy(camera.view(), vx * elapsed, vy * elapsed, live.current.radius)
        const decay = Math.exp(-elapsed / FRICTION_MS)
        vx *= decay
        vy *= decay
        return Math.hypot(vx, vy) > 0.01
      })
    }

    const onWheel = (event: WheelEvent) => {
      const { radius: r, size: s } = live.current
      if (!s) return
      event.preventDefault()
      interrupt()
      const delta = event.deltaY * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 400 : 1) * (event.ctrlKey ? 3 : 1)
      const factor = clamp(Math.exp(-delta * WHEEL_SENSITIVITY), 0.5, 2)
      camera.set(zoomAt(camera.view(), factor, local(event), r, s))
    }

    // A drag ends with a click on whatever is under the pointer; swallow it so it doesn't select a country.
    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      event.stopPropagation()
      event.preventDefault()
    }
    const onPointerDownReset = () => {
      suppressClick = false
    }

    stage.addEventListener('pointerdown', onPointerDownReset, true)
    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointercancel', onPointerUp)
    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('click', onClickCapture, true)
    return () => {
      stage.removeEventListener('pointerdown', onPointerDownReset, true)
      stage.removeEventListener('pointerdown', onPointerDown)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerup', onPointerUp)
      stage.removeEventListener('pointercancel', onPointerUp)
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('click', onClickCapture, true)
    }
  }, [targetRef, camera, engine, size])

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    },
    [],
  )

  return camera
}

function wrap(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/** Interpolates longitudes the short way round. */
function lerpLon(from: number, to: number, t: number) {
  const delta = ((((to - from + 180) % 360) + 360) % 360) - 180
  return wrap(from + delta * t)
}
