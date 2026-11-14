import { geoCircle, geoContains, geoGraticule, geoInterpolate, geoPath } from 'd3-geo'
import type { LineString, Position } from 'geojson'
import { useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from 'react'
import { countries, countriesById, countriesByIso2 } from '../../data'
import { coarseAtlas, visibleGeometry, type Atlas } from '../../data/atlas'
import { loadDetailedAtlas, prefetchDetailedAtlas } from '../../data/detailedShapes'
import { useElementSize } from '../../hooks/dom'
import { useGlobeCamera } from '../../hooks/useGlobeCamera'
import { useGazetteer } from '../../hooks/useGazetteer'
import { useManyPlaces } from '../../hooks/usePlaces'
import { useWater, waterForZoom, type River } from '../../hooks/useWater'
import type { Country } from '../../types/music'
import type { City, Settlement } from '../../types/places'
import { clusterCities, type CityCluster, type Layers, type PlacedCity } from '../../utils/cityClusters'
import {
  angleBetween,
  baseRadius,
  cityView,
  fitView,
  spanForPopulation,
  isFacing,
  mayBeVisible,
  nearSidePath,
  projectionFor,
  screenCuller,
  visibleCap,
  visibleCenter,
  type BoundingCircle,
  type View,
} from '../../utils/globe'
import { mapInsets } from '../../utils/layout'
import { fold, labelBox, placeLabels, type Box, type LabelCandidate } from '../../utils/settlements'
import { antisolarPoint } from '../../utils/sun'
import { inDecade } from '../../hooks/useTimeline'
import { useI18n } from '../../i18n/context'
import type { Timeline } from '../../types/places'
import { CityMarkers, CountryPaths, GravityMarkers, SettlementLabels, SmallCountryDots, WaterLabels, type WaterLabel } from './GlobeLayers'
import { MapBackdrop, MapDefs, MapOverlay } from './MapAtmosphere'
import { MapTooltip, type TooltipHandle } from './MapTooltip'

export type GlobeHandle = {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  /** Zoom out to the whole Earth, wherever the camera is. */
  overview: () => void
}

type GlobeProps = {
  selected: Country | null
  city: City | null
  /** A town or village without music data of its own, opened from search or its label. */
  place: Settlement | null
  isDesktop: boolean
  layers: Layers
  onSelect: (country: Country) => void
  onSelectCity: (country: Country, city: City) => void
  onSelectPlace: (place: Settlement) => void
  onClear: () => void
  /** The first drag, scroll or key press: the onboarding hint can go. */
  onInteract: () => void
  /** Whether the globe is zoomed in far enough to show cities. */
  onZoomedIn?: (zoomedIn: boolean) => void
  /** Country ids to light up: where the songs of the open global chart come from. */
  charting?: ReadonlySet<string>
  /** A panel is open even without a selected country (the global chart), so the globe makes room. */
  panelOpen?: boolean
  /** Shade the half of the Earth where it is night right now. */
  night?: boolean
  /** Similarity map: country id → share of chart songs in common with the selected country (0–1). */
  similarity?: ReadonlyMap<string, number> | null
  /** Time machine: show only what was made in this decade (1840 = before 1850), or everything. */
  decade?: number | null
  timeline?: Timeline
  ref?: Ref<GlobeHandle>
}

const DEFAULT_CENTER: [number, number] = [12, 28]
const ZOOM_STEP = 1.7
/** Above this zoom the 1:50m outlines replace the 1:110m ones once the camera stops… */
const DETAIL_K = 2.2
/** …and above this one even while it moves, because so little is on screen. */
const ALWAYS_DETAILED_K = 12
const SETTLE_MS = 150
/** Cities appear on the globe from this zoom. */
export const CITY_K = 2.8
const MAX_NEARBY_COUNTRIES = 12
/** Music markers that show their name and counts at once; the rest show them on hover. */
const MUSIC_LABELS = 14
/** At most this many town and village names at once; the rest are dots. */
const MAX_SETTLEMENT_LABELS = 36
const DPR_MAX = 2
/** Rivers and lakes load once the globe is zoomed past this, and the biggest are drawn from zoom 1. */
const WATER_LOAD_K = 1.3
const MAX_WATER_LABELS = 10
const HUNGARY = coarseAtlas.shapes.get('348')
const GRAVITY_GLIDE_MS = 900
/** A centre of gravity from a handful of films (the 1890s have one) is noise; show it from this many. */
const GRAVITY_MIN = 25
type Tween = { path: (t: number) => [number, number]; start: number }
/** Animation time; only read in the renderer and in effects, never while React renders. */
const clock = () => performance.now()

/** A marker that has never been positioned would sit in the corner until the next frame places it. */
function hideUntilPlaced(element: HTMLElement): HTMLElement {
  if (!element.style.transform) element.style.visibility = 'hidden'
  return element
}

/** The part of the globe city markers are rendered for (centre, and angular reach in radians). */
type MarkerWindow = { lon: number; lat: number; reach: number }
/** Direction from one screen point to another, flipped so text never reads upside down. */
function uprightAngle([x1, y1]: [number, number], [x2, y2]: [number, number]): number {
  let angle = Math.atan2(y2 - y1, x2 - x1)
  if (angle > Math.PI / 2) angle -= Math.PI
  if (angle < -Math.PI / 2) angle += Math.PI
  return angle
}

/**
 * The night side as nested caps around the point opposite the sun: the outermost is the terminator
 * (90°), the inner ones add up to a darker night beyond the twilight.
 */
const NIGHT_RADII = [91, 89.5, 88, 86.5, 85, 83.5, 82, 80, 78, 76]
const nightShapes = (date: Date) => {
  const center = antisolarPoint(date)
  return NIGHT_RADII.map((radius) => geoCircle().center(center).radius(radius).precision(2)())
}

const graticule = geoGraticule().step([15, 15])()
const fineGraticule = geoGraticule().step([5, 5])()

/** Countries that can be selected: everything with a chart or a place on the map. */
const selectableIds = new Set(countries.map((country) => country.id))
const pathIds = [...new Set([...coarseAtlas.shapes.keys(), ...countries.map((country) => country.id)])]
const smallCountries = countries.filter((country) => country.small)
const NONE: ReadonlySet<string> = new Set()

export function Globe({ selected, city, place: spot, isDesktop, layers, onSelect, onSelectCity, onSelectPlace, onClear, onInteract, onZoomedIn, charting = NONE, panelOpen = false, night = true, decade = null, timeline, similarity = null, ref }: GlobeProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<TooltipHandle>(null)
  const reducedMotion = useReducedMotion() ?? false
  const [detailed, setDetailed] = useState<Atlas | null>(null)
  const [nearby, setNearby] = useState<{ iso2s: string[]; k: number; water: boolean }>({ iso2s: [], k: 1, water: false })
  const [announcement, setAnnouncement] = useState('')
  const { t, lang, countryName } = useI18n()
  const [labels, setLabels] = useState<LabelCandidate[]>([])
  const labelKey = useRef('')
  // Once loaded, the data stays in the query cache even if the camera zooms back out.
  const { data: water } = useWater(nearby.water || !!selected || !!spot)
  const [waterLabels, setWaterLabels] = useState<WaterLabel[]>([])
  const waterLabelKey = useRef('')
  // Where the camera looks and the pin sits: an open city, else an open town or village.
  const focus = city ?? spot

  const radius = size ? baseRadius(size, isDesktop) : 300
  const insets = useMemo(() => (size ? mapInsets(size, isDesktop, !!selected || panelOpen) : null), [size, isDesktop, selected, panelOpen])

  // DOM nodes the renderer writes to directly, every frame.
  const nodes = useRef({
    paths: new Map<string, SVGPathElement>(),
    dots: new Map<string, SVGGElement>(),
    cities: new Map<string, HTMLElement>(),
    glow: null as SVGCircleElement | null,
    ocean: null as SVGCircleElement | null,
    shade: null as SVGCircleElement | null,
    rim: null as SVGCircleElement | null,
    graticule: null as SVGPathElement | null,
    borders: null as SVGPathElement | null,
    highlight: null as SVGPathElement | null,
    glowPath: null as SVGPathElement | null,
    pin: null as HTMLDivElement | null,
    canvas: null as HTMLCanvasElement | null,
    labels: new Map<string, HTMLElement>(),
    lakes: null as SVGPathElement | null,
    rivers: null as SVGPathElement | null,
    majorRivers: null as SVGPathElement | null,
    waterLabels: new Map<string, HTMLElement>(),
    night: [] as (SVGPathElement | null)[],
    trails: { a: null as SVGPathElement | null, f: null as SVGPathElement | null },
    gravity: new Map<string, HTMLElement>(),
  })
  // The centres of gravity glide from one decade's position to the next.
  const gravityTween = useRef<{ a?: Tween; f?: Tween }>({})
  const glideFrame = useRef(0)
  // Where night is right now; computed on the first frame and refreshed every minute.
  const night$ = useRef<ReturnType<typeof nightShapes> | null>(null)

  // Countries whose cities show: the ones in view once zoomed in, and the selected one.
  const wanted = useMemo(() => {
    const list = new Set(nearby.iso2s)
    if (selected && selected.cityCount > 0) list.add(selected.iso2)
    return [...list].sort()
  }, [nearby.iso2s, selected])
  const showCities = nearby.k >= CITY_K

  // Towns and villages of the same countries, for dots and labels.
  const { data: gazetteer } = useGazetteer(showCities || !!spot)
  const settlementsKey = showCities ? wanted.join() : ''
  const settlements = useMemo(() => {
    if (!gazetteer || !settlementsKey) return []
    return settlementsKey
      .split(',')
      .flatMap((iso2) => gazetteer.byCountry.get(iso2) ?? [])
      .sort((a, b) => b.population - a.population)
  }, [gazetteer, settlementsKey])

  const nearbyKey = useRef('')
  const nearbyTimer = useRef<number | undefined>(undefined)
  // City markers exist only around what's on screen: with a dozen countries loaded there are over a
  // thousand, and each one costs style and layout work on every change.
  const [markerWindow, setMarkerWindow] = useState<MarkerWindow | null>(null)
  const markerWindowKey = useRef('')
  const pendingWindow = useRef<MarkerWindow | null>(null)
  const markerWindowTimer = useRef<number | undefined>(undefined)

  // ── Drawing ────────────────────────────────────────────────────────────────
  // Moving frames use the light 1:110m shapes (about 10 ms); once the camera rests, one frame
  // redraws with the 1:50m shapes, which would take 30–80 ms on every frame.
  const settleTimer = useRef<number | undefined>(undefined)
  const lastView = useRef<View | null>(null)
  const latestDraw = useRef<(view: View, settled?: boolean) => void>(() => {})
  const draw = (view: View, settled = false) => {
    if (!size) return
    const n = nodes.current
    const projection = projectionFor(view, radius, size)
    const path = geoPath(projection).digits(1)
    const r = radius * view.k
    for (const [circle, scale] of [[n.glow, 1.14], [n.ocean, 1], [n.shade, 1], [n.rim, 1]] as const) {
      circle?.setAttribute('cx', String(view.x))
      circle?.setAttribute('cy', String(view.y))
      circle?.setAttribute('r', String(Math.max(r * scale, 0)))
    }
    n.graticule?.setAttribute('d', path(view.k > 7 ? fineGraticule : graticule) ?? '')

    const cap = visibleCap(view, radius, size)
    const visible = screenCuller(view, radius, size, projection)
    const center: [number, number] = [view.lon, view.lat]
    // Shapes wholly on the near side skip d3's clipping (see nearSidePath); the rest go through d3.
    const near = nearSidePath(view, radius)
    const linesPath = (items: { line: LineString; centroid: [number, number]; radius: number }[]) => {
      const nearLines: Position[][] = []
      const farLines: Position[][] = []
      for (const item of items) (near.facing(item) ? nearLines : farLines).push(item.line.coordinates)
      return near.lines(nearLines) + (farLines.length ? (path({ type: 'MultiLineString', coordinates: farLines }) ?? '') : '')
    }
    const wantsDetail = view.k >= DETAIL_K && !!detailed
    const fine = wantsDetail && (settled || view.k >= ALWAYS_DETAILED_K)
    const atlas = fine && detailed ? detailed : coarseAtlas
    // When the camera rests: one detailed frame, and a fresh choice of names. Redraws that don't move
    // the camera (data arriving, React re-rendering) must not postpone it, or it might never come.
    const last = lastView.current
    const moved = !last || last.lon !== view.lon || last.lat !== view.lat || last.k !== view.k || last.x !== view.x || last.y !== view.y
    lastView.current = view
    if (settled) settleTimer.current = undefined
    else if (moved || settleTimer.current === undefined) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(() => {
        settleTimer.current = undefined
        latestDraw.current(lastView.current ?? view, true)
      }, SETTLE_MS)
    }
    // Only the polygons that can be on screen: not France's Guiana over Europe, nor Alaska over Asia.
    for (const [id, element] of n.paths) {
      const shape = atlas.shapes.get(id) ?? detailed?.shapes.get(id)
      const geometry = shape && visibleGeometry(shape, visible, center)
      element.setAttribute('d', geometry ? (near.facing(shape) && near.geometry(geometry)) || (path(geometry) ?? '') : '')
    }
    n.borders?.setAttribute('d', linesPath(atlas.borders.filter(visible)))

    if (n.highlight && selected) {
      const shape = detailed?.shapes.get(selected.id) ?? coarseAtlas.shapes.get(selected.id)
      const geometry = shape && visibleGeometry(shape, visible, center)
      const d = geometry ? (near.facing(shape) && near.geometry(geometry)) || (path(geometry) ?? '') : ''
      n.highlight.setAttribute('d', d)
      n.glowPath?.setAttribute('d', d)
    }
    drawWater(view, path, visible, near, linesPath)
    drawGravity(view, path, projection)
    const shapes = (night$.current ??= nightShapes(new Date()))
    n.night.forEach((element, index) => element?.setAttribute('d', night ? (path(shapes[index]) ?? '') : ''))

    // Small countries get a dot until their outline is big enough to click.
    for (const [id, element] of n.dots) {
      const country = countriesById.get(id)
      const point = country && projection(country.center)
      const show = !!point && view.k < 10 && isFacing(view, country.center)
      element.style.display = show ? '' : 'none'
      if (show) element.setAttribute('transform', `translate(${point[0]},${point[1]})`)
    }

    // Zoomed in there can be a thousand markers, mostly off screen: only touch the DOM when needed.
    const place = (element: HTMLElement, lon: number, lat: number) => {
      const point = isFacing(view, [lon, lat], 0.04) ? projection([lon, lat]) : null
      const show = !!point && point[0] > -40 && point[0] < size.width + 40 && point[1] > -40 && point[1] < size.height + 40
      const visibility = show ? '' : 'hidden'
      if (element.style.visibility !== visibility) element.style.visibility = visibility
      if (show) element.style.transform = `translate3d(${point[0]}px, ${point[1]}px, 0)`
    }
    for (const element of n.cities.values()) place(element, Number(element.dataset.lon), Number(element.dataset.lat))
    for (const element of n.labels.values()) place(element, Number(element.dataset.lon), Number(element.dataset.lat))
    // River names turn with the river: the angle comes from a second point a little downstream.
    for (const element of n.waterLabels.values()) {
      const at: [number, number] = [Number(element.dataset.lon), Number(element.dataset.lat)]
      const point = isFacing(view, at, 0.04) ? projection(at) : null
      const show = !!point && point[0] > -60 && point[0] < size.width + 60 && point[1] > -30 && point[1] < size.height + 30
      if (element.style.visibility !== (show ? '' : 'hidden')) element.style.visibility = show ? '' : 'hidden'
      if (!show) continue
      const along = element.dataset.lon2 ? projection([Number(element.dataset.lon2), Number(element.dataset.lat2)]) : null
      element.style.transform = `translate3d(${point[0]}px, ${point[1]}px, 0) translate(-50%, -50%) rotate(${along ? uprightAngle(point, along) : 0}rad)`
    }
    if (n.pin && focus) place(n.pin, focus.lon, focus.lat)

    const candidates = drawSettlements(view, projection)
    if (settled) chooseLabels(candidates, projection)

    trackNearby(view, cap, visible)
  }

  // Tell React which countries' cities to load, throttled: this runs every frame.
  const trackNearby = (view: View, cap: number, visible: (circle: BoundingCircle) => boolean) => {
    const iso2s =
      view.k < CITY_K
        ? []
        : countries
            .filter((country) => country.cityCount > 0)
            .filter((country) => {
              const shape = coarseAtlas.shapes.get(country.id) ?? detailed?.shapes.get(country.id)
              return shape ? visibleGeometry(shape, visible, [view.lon, view.lat]) !== null : isFacing(view, country.center)
            })
            .map((country) => ({ iso2: country.iso2, distance: angleBetween(country.center[0], country.center[1], view.lon, view.lat) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, MAX_NEARBY_COUNTRIES)
            .map(({ iso2 }) => iso2)
            .sort()
    trackMarkerWindow(view, cap)
    // Re-cluster when the zoom changes by about a quarter, not on every frame.
    const k = view.k < CITY_K ? 1 : 2 ** (Math.round(Math.log2(view.k) * 4) / 4)
    const water = view.k >= WATER_LOAD_K
    const key = `${iso2s.join()}|${k}|${water}`
    if (key === nearbyKey.current) return
    nearbyKey.current = key
    window.clearTimeout(nearbyTimer.current)
    nearbyTimer.current = window.setTimeout(() => setNearby({ iso2s, k, water }), 120)
  }
  /**
   * Where markers should exist: the visible cap and as much again around it, re-chosen (at most every
   * 150 ms) once the camera has moved a third of the way across the screen or zoomed by half.
   */
  const trackMarkerWindow = (view: View, cap: number) => {
    if (view.k < CITY_K) return
    const capStep = 2 ** (Math.round(Math.log2(cap) * 2) / 2)
    const step = Math.max((capStep * 180) / Math.PI / 3, 0.2)
    const lon = Math.round(view.lon / step) * step
    const lat = Math.round(view.lat / step) * step
    const key = `${lon}|${lat}|${capStep}`
    if (key === markerWindowKey.current) return
    markerWindowKey.current = key
    pendingWindow.current = { lon, lat, reach: Math.min(Math.PI, capStep * 2 + (step * Math.PI) / 180) }
    if (markerWindowTimer.current !== undefined) return
    markerWindowTimer.current = window.setTimeout(() => {
      markerWindowTimer.current = undefined
      setMarkerWindow(pendingWindow.current)
    }, 150)
  }

  /** Dots for every town and village in view; returns the visible ones, most populous first. */
  const drawSettlements = (view: View, projection: ReturnType<typeof projectionFor>): LabelCandidate[] => {
    const canvas = nodes.current.canvas
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !size) return []
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size.width, size.height)
    if (view.k < CITY_K) return []
    // Zoomed out a little, only the bigger places; all of them once a county fills the screen.
    // (Hungary fills the screen at about 17×; every village shows from about 35×.)
    const minimum = view.k < 5 ? 10_000 : view.k < 9 ? 3000 : view.k < 20 ? 1000 : view.k < 35 ? 300 : 0
    // Small dots from afar, so rivers and borders still show through; bigger ones up close.
    const scale = Math.min(1, 0.45 + view.k / 60)
    const visible: LabelCandidate[] = []
    context.fillStyle = 'rgb(226 232 245 / 0.62)'
    context.strokeStyle = 'rgb(6 10 20 / 0.55)'
    context.lineWidth = 1
    for (const settlement of settlements) {
      if (settlement.population < minimum) continue
      if (!isFacing(view, [settlement.lon, settlement.lat], 0.02)) continue
      const point = projection([settlement.lon, settlement.lat])
      if (!point || point[0] < -10 || point[1] < -10 || point[0] > size.width + 10 || point[1] > size.height + 10) continue
      const r = (1.1 + Math.log10(settlement.population + 10) * 0.3) * scale
      context.beginPath()
      context.arc(point[0], point[1], r, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      visible.push({ id: settlement.id, name: settlement.name, x: point[0], y: point[1] })
    }
    return visible
  }

  /** The time machine's trails (decades so far) and centres of gravity (this decade, mid-glide). */
  const drawGravity = (view: View, path: ReturnType<typeof geoPath>, projection: ReturnType<typeof projectionFor>) => {
    const n = nodes.current
    const index = timeline && decade !== null ? timeline.decades.indexOf(decade) : -1
    for (const kind of ['a', 'f'] as const) {
      const shown = index >= 0 && timeline && (kind === 'a' ? layers.music : layers.films)
      const points = shown
        ? timeline.centers[kind].slice(0, index + 1).flatMap((center) => (center && center[2] >= GRAVITY_MIN ? [[center[0], center[1]] as [number, number]] : []))
        : []
      n.trails[kind]?.setAttribute('d', points.length > 1 ? (path({ type: 'LineString', coordinates: points }) ?? '') : '')
    }
    glide(view, projection)
  }

  /**
   * Places the centres of gravity along their glide, and while they're still moving asks for another
   * frame that moves only them: nothing else on the globe changes meanwhile.
   */
  const glide = (view: View, projection: ReturnType<typeof projectionFor>) => {
    let gliding = false
    for (const kind of ['a', 'f'] as const) {
      const element = nodes.current.gravity.get(kind)
      const tween = gravityTween.current[kind]
      if (!element || !tween) continue
      const t = Math.min(1, (clock() - tween.start) / GRAVITY_GLIDE_MS)
      const at = tween.path(1 - (1 - t) ** 3)
      const point = isFacing(view, at, 0.02) ? projection(at) : null
      element.style.visibility = point ? '' : 'hidden'
      if (point) element.style.transform = `translate3d(${point[0]}px, ${point[1]}px, 0)`
      gliding ||= t < 1
    }
    // At most one frame waiting at a time, and none while the camera draws frames anyway.
    if (gliding && !glideFrame.current && !camera.isMoving()) {
      glideFrame.current = requestAnimationFrame(() => {
        glideFrame.current = 0
        const current = lastView.current
        if (current && size) glide(current, projectionFor(current, radius, size))
      })
    }
  }

  /** Lakes filled, rivers stroked: the big ones from afar, smaller ones as the camera comes closer. */
  const drawWater = (
    view: View,
    path: ReturnType<typeof geoPath>,
    visible: (circle: BoundingCircle) => boolean,
    near: ReturnType<typeof nearSidePath>,
    linesPath: (items: River[]) => string,
  ) => {
    const n = nodes.current
    if (!water) return
    const { lakes: allLakes, rivers } = waterForZoom(water, view.k, radius)
    // Lakes smaller than a pixel or so would only be specks.
    const lakes = allLakes.filter((lake) => view.k >= lake.k && lake.size * radius * view.k >= 1.5 && visible(lake))
    n.lakes?.setAttribute('d', lakes.map((lake) => (near.facing(lake) && near.geometry(lake.polygon)) || (path(lake.polygon) ?? '')).join(''))
    // Rivers that appeared well before this zoom are the important ones here: draw them thicker.
    const major: River[] = []
    const minor: River[] = []
    for (const river of rivers) {
      if (view.k < river.k || !visible(river)) continue
      ;(river.k * 3 <= view.k ? major : minor).push(river)
    }
    n.rivers?.setAttribute('d', linesPath(minor))
    n.majorRivers?.setAttribute('d', linesPath(major))
  }

  /**
   * Names for the most important rivers and lakes on screen, before the towns get theirs. Inside
   * Hungary they're in Hungarian (Duna, Balaton), elsewhere in English.
   */
  const chooseWaterLabels = (view: View, projection: ReturnType<typeof projectionFor>, occupied: Box[]) => {
    if (!water || !size) return
    const cap = visibleCap(view, radius, size)
    const onScreen = (point: [number, number] | null): point is [number, number] =>
      !!point && point[0] > 30 && point[0] < size.width - 30 && point[1] > 70 && point[1] < size.height - 30
    // Hungarian names for Hungarian readers everywhere, and inside Hungary for everyone (Duna, Balaton).
    const local = (name: string, hu: string, at: [number, number]) => (hu && (lang === 'hu' || (HUNGARY && geoContains(HUNGARY.feature, at))) ? hu : name)
    type Candidate = WaterLabel & { k: number; size: number; angle: number }
    const candidates: Candidate[] = []

    for (const lake of water.lakes) {
      if (!lake.name || view.k < lake.k || !mayBeVisible(view, lake, cap)) continue
      const extent = lake.size * radius * view.k // the lake's angular radius in pixels
      const point = isFacing(view, lake.centroid) ? projection(lake.centroid) : null
      if (extent < 14 || !onScreen(point)) continue
      candidates.push({ id: `lake:${lake.name}:${lake.centroid.join()}`, text: local(lake.name, lake.hu, lake.centroid), lon: lake.centroid[0], lat: lake.centroid[1], kind: 'lake', k: lake.k, size: extent, angle: 0 })
    }
    // One name per river, on whichever of its pieces nearest the middle of the screen has room.
    const center: [number, number] = [view.lon, view.lat]
    const pieces = new Map<string, { candidate: Candidate; distance: number }[]>()
    for (const river of water.rivers) {
      if (!river.name || view.k < river.k || !mayBeVisible(view, river, cap)) continue
      const coordinates = river.line.coordinates as [number, number][]
      if (coordinates.length < 3) continue
      // A piece can run 300 km (Bratislava to Mohács): try a few points along it.
      for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const index = Math.min(Math.round((coordinates.length - 1) * fraction), coordinates.length - 2)
        const at = coordinates[index]
        const next = coordinates[Math.min(index + 2, coordinates.length - 1)]
        const point = isFacing(view, at) ? projection(at) : null
        const ahead = projection(next)
        if (!onScreen(point) || !ahead) continue
        const text = local(river.name, river.hu, at)
        const candidate: Candidate = { id: `river:${river.name}`, text, lon: at[0], lat: at[1], lon2: next[0], lat2: next[1], kind: 'river', k: river.k, size: 0, angle: uprightAngle(point, ahead) }
        pieces.set(river.name, [...(pieces.get(river.name) ?? []), { candidate, distance: angleBetween(at[0], at[1], center[0], center[1]) }])
      }
    }
    const options = new Map<Candidate, Candidate[]>()
    for (const list of pieces.values()) {
      const sorted = list.sort((a, b) => a.distance - b.distance).map(({ candidate }) => candidate)
      candidates.push(sorted[0])
      options.set(sorted[0], sorted.slice(0, 12))
    }
    candidates.sort((a, b) => a.k - b.k || b.size - a.size)

    const fits = (candidate: Candidate) => {
      const point = projection([candidate.lon, candidate.lat])
      if (!point) return null
      // The space a (possibly turned) name takes, as an upright box.
      const width = candidate.text.length * 6.6 + 8
      const height = 16
      const cos = Math.abs(Math.cos(candidate.angle))
      const sin = Math.abs(Math.sin(candidate.angle))
      const box = { x: point[0] - (width * cos + height * sin) / 2, y: point[1] - (width * sin + height * cos) / 2, width: width * cos + height * sin, height: width * sin + height * cos }
      return occupied.some((other) => box.x < other.x + other.width && other.x < box.x + box.width && box.y < other.y + other.height && other.y < box.y + box.height) ? null : box
    }
    const chosen: WaterLabel[] = []
    for (const candidate of candidates) {
      for (const option of options.get(candidate) ?? [candidate]) {
        const box = fits(option)
        if (!box) continue
        occupied.push(box)
        chosen.push(option)
        break
      }
      if (chosen.length === MAX_WATER_LABELS) break
    }
    const key = chosen.map((label) => `${label.id}|${label.text}`).join()
    if (key === waterLabelKey.current) return
    waterLabelKey.current = key
    setWaterLabels(chosen.map(({ id, text, lon, lat, lon2, lat2, kind }) => ({ id, text, lon, lat, lon2, lat2, kind })))
  }

  /** Names for the towns that fit, around the music markers (which keep their place). */
  const chooseLabels = (candidates: LabelCandidate[], projection: ReturnType<typeof projectionFor>) => {
    // Music markers first: the heaviest ones on screen get their names.
    const markers = [...nodes.current.cities.values()]
    const onScreen = markers
      .filter((element) => element.style.visibility !== 'hidden')
      .sort((a, b) => Number(b.dataset.weight) - Number(a.dataset.weight))
    const named = new Set(onScreen.slice(0, MUSIC_LABELS))
    for (const element of markers) element.classList.toggle('has-label', named.has(element))

    const occupied: Box[] = []
    const musicNames = new Set<string>()
    for (const element of onScreen) {
      const point = projection([Number(element.dataset.lon), Number(element.dataset.lat)])
      if (!point) continue
      occupied.push({ x: point[0] - 10, y: point[1] - 10, width: 20, height: 20 })
      if (element.classList.contains('has-label')) occupied.push({ x: point[0] + 6, y: point[1] - 11, width: 150, height: 22 })
      if (element.dataset.name) musicNames.add(fold(element.dataset.name))
    }
    // Rivers and lakes next, so towns fit around them.
    chooseWaterLabels(lastView.current ?? camera.view(), projection, occupied)
    // The opened town always gets its name, however small; then the most populous that fit around it.
    const others = candidates.filter((candidate) => !musicNames.has(fold(candidate.name)) && candidate.id !== spot?.id)
    const opened = spot && candidates.find((candidate) => candidate.id === spot.id)
    if (opened) occupied.push(labelBox(opened))
    const chosen = [...(opened ? [opened] : []), ...placeLabels(others, occupied, MAX_SETTLEMENT_LABELS - (opened ? 1 : 0))]
    const key = chosen.map((label) => label.id).join()
    if (key === labelKey.current) return
    labelKey.current = key
    setLabels(chosen)
  }

  useEffect(
    () => () => {
      window.clearTimeout(nearbyTimer.current)
      window.clearTimeout(settleTimer.current)
      window.clearTimeout(markerWindowTimer.current)
      cancelAnimationFrame(glideFrame.current)
    },
    [],
  )

  // ── Camera ─────────────────────────────────────────────────────────────────
  const interactedRef = useRef(false)
  const camera = useGlobeCamera({
    targetRef: containerRef,
    radius,
    size,
    reducedMotion,
    initialView: () => {
      const [x, y] = size && insets ? visibleCenter(size, insets) : [0, 0]
      // The intro spins in from the east.
      return { lon: DEFAULT_CENTER[0] + 70, lat: DEFAULT_CENTER[1] - 8, k: 0.78, x, y }
    },
    onFrame: (view) => draw(view),
    onInteract: () => {
      if (!interactedRef.current) {
        interactedRef.current = true
        onInteract()
      }
      tooltipRef.current?.hide()
      if (!detailed) void loadDetailedAtlas().then(setDetailed, () => {})
    },
  })

  useEffect(() => prefetchDetailedAtlas(setDetailed), [])

  // The terminator creeps west a quarter of a degree a minute.
  useEffect(() => {
    const timer = window.setInterval(() => {
      night$.current = nightShapes(new Date())
      if (lastView.current) latestDraw.current(lastView.current)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Redraw whenever React changes something the renderer reads (new markers, selection, a decade), unless
  // the camera is moving: then the next frame draws anyway, and drawing twice a frame halves the frame rate.
  // At rest it is a resting frame (detailed shapes, fresh names): a moving one would show coarse outlines
  // for a moment and need a second, detailed draw after it.
  useLayoutEffect(() => {
    latestDraw.current = draw
    if (size && !camera.isMoving()) draw(camera.view(), true)
  })

  const targetFor = useCallback(
    (from: View): View | null => {
      if (!size || !insets) return null
      if (city) return cityView(city.lon, city.lat, size, insets, radius, from.k)
      if (spot) return cityView(spot.lon, spot.lat, size, insets, radius, from.k, spanForPopulation(spot.population))
      if (selected) return fitView(selected.bbox, selected.center, size, insets, radius)
      const [x, y] = visibleCenter(size, insets)
      return { lon: from.lon, lat: from.lat, k: 1, x, y }
    },
    [size, insets, radius, city, spot, selected],
  )

  // The camera follows the selection: fly to a new country or city, re-frame instantly on resize.
  const lastTarget = useRef<string | undefined>(undefined)
  useEffect(() => {
    const target = targetFor(camera.view())
    if (!target) return
    const key = focus ? `focus:${focus.id}` : (selected?.id ?? '')
    const first = lastTarget.current === undefined
    const same = lastTarget.current === key
    lastTarget.current = key
    if (first) {
      const start = camera.view()
      const intro = selected ? target : { ...target, lon: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] }
      camera.set({ ...start, x: target.x, y: target.y })
      camera.flyTo(intro, { duration: selected ? 1700 : 1500, ease: (t) => 1 - (1 - t) ** 3 })
    } else if (same && (selected || focus)) {
      camera.set(target)
    } else if (same) {
      // A panel opened or closed over the bare globe: glide it aside.
      camera.flyTo({ ...camera.view(), x: target.x, y: target.y }, { duration: 500 })
    } else {
      camera.flyTo(target)
    }
    camera.autoRotate(!selected && !interactedRef.current)
  }, [camera, targetFor, selected, focus])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        onInteract()
        if (size && insets) camera.zoomBy(ZOOM_STEP, visibleCenter(size, insets))
      },
      zoomOut: () => {
        onInteract()
        if (size && insets) camera.zoomBy(1 / ZOOM_STEP, visibleCenter(size, insets))
      },
      reset: () => {
        const view = camera.view()
        const target = targetFor({ ...view, k: 1 })
        if (target) camera.flyTo(selected || focus ? target : { ...target, k: 1 })
      },
      overview: () => {
        const view = camera.view()
        camera.flyTo({ ...view, k: 1 })
      },
    }),
    [camera, size, insets, targetFor, selected, focus, onInteract],
  )

  // ── Cities on the globe ────────────────────────────────────────────────────
  const places = useManyPlaces(wanted)
  useEffect(() => onZoomedIn?.(showCities), [onZoomedIn, showCities])
  const clusters = useMemo<CityCluster[]>(() => {
    if (!showCities) return []
    const placed: PlacedCity[] = places.flatMap(({ iso2, cities }) => {
      const country = countries.find((c) => c.iso2 === iso2)
      if (!country) return []
      // In the time machine, a city counts only what was born, formed or made there in the decade.
      return cities.map((c) =>
        decade === null
          ? { country, city: c }
          : {
              country,
              city: {
                ...c,
                chart: undefined,
                artists: c.artists.filter((artist) => inDecade(artist.year, decade)),
                films: c.films.filter((film) => inDecade(film.year, decade)),
              },
            },
      )
    })
    return clusterCities(placed, layers, radius * nearby.k)
  }, [places, layers, radius, nearby.k, showCities, decade])
  const shownClusters = useMemo(
    () =>
      markerWindow
        ? clusters.filter((cluster) => cluster.key === city?.id || angleBetween(markerWindow.lon, markerWindow.lat, cluster.lon, cluster.lat) < markerWindow.reach)
        : clusters,
    [clusters, markerWindow, city],
  )

  // Time machine: countries coloured by how much was made there in the decade.
  const decadeHeat = useMemo(() => {
    if (decade === null || !timeline) return null
    const index = timeline.decades.indexOf(decade)
    const amounts = new Map<string, number>()
    for (const [iso2, counts] of Object.entries(timeline.countries)) {
      const country = countriesByIso2.get(iso2.toLowerCase())
      const amount = (layers.music ? counts.a[index] : 0) + (layers.films ? counts.f[index] : 0)
      if (country && amount) amounts.set(country.id, amount)
    }
    const most = Math.max(1, ...amounts.values())
    // Square root, so a country with a few doesn't vanish next to one with hundreds.
    return new Map([...amounts].map(([id, amount]) => [id, Math.round(14 + 72 * Math.sqrt(amount / most))]))
  }, [decade, timeline, layers])

  // In the time machine, hovering a country tells what it made in the decade.
  const decadeNote = useMemo(() => {
    if (decade === null || !timeline) return undefined
    const index = timeline.decades.indexOf(decade)
    return (countryId: string) => {
      const country = countriesById.get(countryId)
      const counts = country && timeline.countries[country.iso2]
      const artists = counts?.a[index] ?? 0
      const films = counts?.f[index] ?? 0
      return t.globe.decadeNote(t.decade.label(decade), artists, films)
    }
  }, [decade, timeline, t])

  // The similarity map takes over the colouring while it's on; otherwise the time machine's, if open.
  const heat = useMemo(
    () => (similarity ? new Map([...similarity].map(([id, share]) => [id, Math.round(6 + 82 * Math.sqrt(share))])) : decadeHeat),
    [similarity, decadeHeat],
  )

  // Start a glide to the new decade's centres from wherever the markers are now.
  useEffect(() => {
    if (decade === null || !timeline) {
      gravityTween.current = {}
      return
    }
    const index = timeline.decades.indexOf(decade)
    const now = clock()
    for (const kind of ['a', 'f'] as const) {
      const center = timeline.centers[kind][index]
      if (!center || center[2] < GRAVITY_MIN) {
        delete gravityTween.current[kind]
        continue
      }
      const target: [number, number] = [center[0], center[1]]
      const previous = gravityTween.current[kind]
      const from = previous ? previous.path(Math.min(1, (now - previous.start) / GRAVITY_GLIDE_MS)) : target
      gravityTween.current[kind] = { path: geoInterpolate(from, target), start: now }
    }
    latestDraw.current(lastView.current ?? camera.view())
  }, [decade, timeline, camera])

  const labelledSettlements = useMemo(
    () => (gazetteer ? labels.flatMap((label) => gazetteer.byId.get(label.id) ?? []) : []),
    [labels, gazetteer],
  )

  const openCluster = (cluster: CityCluster) => {
    if (cluster.lead) {
      onSelectCity(cluster.lead.country, cluster.lead.city)
      return
    }
    const view = camera.view()
    camera.flyTo({ ...view, lon: cluster.lon, lat: cluster.lat, k: Math.min(view.k * 2.6, 90) }, { duration: 750 })
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const countryFromEvent = (target: EventTarget) => {
    const element = (target as Element).closest<SVGElement>('[data-country]')
    return element?.dataset.country ? countriesById.get(element.dataset.country) : undefined
  }

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    const country = countryFromEvent(event.target)
    if (country) onSelect(country)
    else if (selected && !(event.target as Element).closest('.country')) onClear() // space or ocean, not a country without data
  }

  const countryAtCenter = (): Country | undefined => {
    if (!size) return undefined
    const view = camera.view()
    const point = projectionFor(view, radius, size).invert?.([view.x, view.y])
    if (!point) return undefined
    const atlas = detailed ?? coarseAtlas
    for (const country of countries) {
      const shape = atlas.shapes.get(country.id)
      if (shape && geoContains(shape.feature, point)) return country
    }
    return undefined
  }

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) {
      if ((event.key === 'Enter' || event.key === ' ') && countryFromEvent(event.target)) {
        event.preventDefault()
        onSelect(countryFromEvent(event.target)!)
      }
      return
    }
    const step = 70
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[event.key]) {
      event.preventDefault()
      onInteract()
      interactedRef.current = true
      camera.autoRotate(false)
      camera.rotate(...moves[event.key])
      const centred = countryAtCenter()
      setAnnouncement(centred ? countryName(centred) : t.globe.ocean)
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      camera.zoomBy(ZOOM_STEP)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      camera.zoomBy(1 / ZOOM_STEP)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const country = countryAtCenter()
      if (country) onSelect(country)
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.buttons) {
      tooltipRef.current?.hide()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const geoId = (event.target as Element).closest<SVGElement>('[data-geo]')?.dataset.geo ?? null
    tooltipRef.current?.update(event.clientX - rect.left, event.clientY - rect.top, geoId)
  }

  const register = useMemo(
    () => ({
      path: (id: string, element: SVGPathElement | null) => {
        if (element) nodes.current.paths.set(id, element)
        else nodes.current.paths.delete(id)
      },
      dot: (id: string, element: SVGGElement | null) => {
        if (element) nodes.current.dots.set(id, element)
        else nodes.current.dots.delete(id)
      },
      city: (key: string, element: HTMLElement | null) => {
        if (element) nodes.current.cities.set(key, hideUntilPlaced(element))
        else nodes.current.cities.delete(key)
      },
      label: (key: string, element: HTMLElement | null) => {
        if (element) nodes.current.labels.set(key, hideUntilPlaced(element))
        else nodes.current.labels.delete(key)
      },
      water: (key: string, element: HTMLElement | null) => {
        if (element) nodes.current.waterLabels.set(key, hideUntilPlaced(element))
        else nodes.current.waterLabels.delete(key)
      },
      gravity: (key: string, element: HTMLElement | null) => {
        if (element) nodes.current.gravity.set(key, element)
        else nodes.current.gravity.delete(key)
      },
    }),
    [],
  )

  return (
    <div
      ref={containerRef}
      className="globe-stage absolute inset-0"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => tooltipRef.current?.hide()}
      onPointerDown={() => tooltipRef.current?.hide()}
    >
      <MapBackdrop />
      {size && (
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="application"
          aria-roledescription="globe"
          aria-label={t.globe.label}
          className="globe relative"
        >
          <MapDefs />
          <circle ref={(el) => void (nodes.current.glow = el)} className="globe-glow" />
          <circle ref={(el) => void (nodes.current.ocean = el)} className="globe-ocean" />
          <path ref={(el) => void (nodes.current.graticule = el)} className="map-graticule" />
          <CountryPaths ids={pathIds} selectable={selectableIds} selectedId={selected?.id ?? null} charting={charting} heat={heat} tone={similarity ? 'accent' : 'amber'} register={register.path} />
          <path ref={(el) => void (nodes.current.borders = el)} className="map-borders" />
          {selected && <path key={`glow-${selected.id}`} ref={(el) => void (nodes.current.glowPath = el)} className="country-glow" />}
          {selected && <path key={selected.id} ref={(el) => void (nodes.current.highlight = el)} className="country-highlight" />}
          <path ref={(el) => void (nodes.current.lakes = el)} className="water-lakes" />
          <path ref={(el) => void (nodes.current.rivers = el)} className="water-rivers" />
          <path ref={(el) => void (nodes.current.majorRivers = el)} className="water-rivers is-major" />
          <g className="night" aria-hidden>
            {NIGHT_RADII.map((radius, index) => (
              <path key={radius} ref={(el) => void (nodes.current.night[index] = el)} />
            ))}
          </g>
          <path ref={(el) => void (nodes.current.trails.a = el)} className="gravity-trail is-music" />
          <path ref={(el) => void (nodes.current.trails.f = el)} className="gravity-trail is-films" />
          <circle ref={(el) => void (nodes.current.shade = el)} className="globe-shade" />
          <circle ref={(el) => void (nodes.current.rim = el)} className="globe-rim" />
          <SmallCountryDots countries={smallCountries} selectedId={selected?.id ?? null} register={register.dot} />
        </svg>
      )}
      {size && (
        <canvas
          ref={(el) => void (nodes.current.canvas = el)}
          width={Math.round(size.width * Math.min(window.devicePixelRatio || 1, DPR_MAX))}
          height={Math.round(size.height * Math.min(window.devicePixelRatio || 1, DPR_MAX))}
          className="settlement-dots"
          aria-hidden
        />
      )}
      <WaterLabels labels={waterLabels} register={register.water} />
      <SettlementLabels settlements={labelledSettlements} selectedId={spot?.id ?? null} register={register.label} onOpen={onSelectPlace} />
      <CityMarkers
        clusters={shownClusters}
        selectedCityId={city?.id ?? null}
        selectedCountryId={selected?.id ?? null}
        register={register.city}
        onOpen={openCluster}
      />
      {decade !== null && timeline && (
        <GravityMarkers
          label={t.decade.label(decade)}
          showMusic={layers.music && (timeline.centers.a[timeline.decades.indexOf(decade)]?.[2] ?? 0) >= GRAVITY_MIN}
          showFilms={layers.films && (timeline.centers.f[timeline.decades.indexOf(decade)]?.[2] ?? 0) >= GRAVITY_MIN}
          register={register.gravity}
        />
      )}
      {focus && (
        <div key={focus.id} ref={(el) => void (nodes.current.pin = el)} className="city-pin" aria-hidden>
          <span />
        </div>
      )}
      <MapOverlay />
      <MapTooltip ref={tooltipRef} containerWidth={size?.width ?? 0} note={decadeNote} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}

