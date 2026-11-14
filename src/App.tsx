import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AboutDialog } from './components/Layout/AboutDialog'
import { ArtistCard, type ArtistRef } from './components/Layout/ArtistCard'
import { SongCard, type SongRef } from './components/Layout/SongCard'
import { Legend, MapControls, OnboardingHint } from './components/Layout/MapChrome'
import { MiniPlayer } from './components/Layout/MiniPlayer'
import { QuizCard } from './components/Layout/QuizCard'
import { SongSpotlight } from './components/Layout/SongSpotlight'
import { TimeMachine } from './components/Layout/TimeMachine'
import { TopBar } from './components/Layout/TopBar'
import { Globe, type GlobeHandle } from './components/Map/Globe'
import type { PanelTab } from './components/Sidebar/CountryContent'
import { CountryPanel, CountrySheet } from './components/Sidebar/CountryPanel'
import { AllTimeContent } from './components/Sidebar/AllTimeContent'
import type { ChartMode } from './components/Sidebar/ChartModeSwitch'
import { GlobalChartContent } from './components/Sidebar/GlobalChartContent'
import { PanelFrame, SheetFrame } from './components/Sidebar/PanelFrames'
import { countries, countriesByIso2 } from './data'
import { useHotkeys, useMediaQuery } from './hooks/dom'
import { chartPositions, useChartIndex, useGlobalChart } from './hooks/useChart'
import { SpotlightContext, type SpotlightTrack } from './hooks/useSpotlight'
import { gazetteerQuery, useGazetteer } from './hooks/useGazetteer'
import { placesQuery, usePlaces } from './hooks/usePlaces'
import { useQuiz } from './hooks/useQuiz'
import { useSelection } from './hooks/useSelection'
import { useDecade, useTimeline } from './hooks/useTimeline'
import type { SongEntry } from './types/hits'
import type { Country, Genre } from './types/music'
import type { City, Settlement } from './types/places'
import { originCounts } from './utils/chartOrigins'
import type { Layers } from './utils/cityClusters'
import { useAllTime, useSongIndex } from './hooks/useHits'
import type { ArtistMatch } from './types/artists'
import { anySongKey, nameKey, type SongHit } from './utils/hitSearch'
import { cityFor } from './utils/settlements'
import { neighbours } from './utils/similarity'
import { songKey } from './utils/songKey'
import { DESKTOP_QUERY } from './utils/layout'
import { clearFlag, DEFAULT_HUE, pickRandom, readFlag, setAccentHue, writeFlag } from './utils/misc'

const loadPalette = () => import('./components/Search/CommandPalette')
const CommandPalette = lazy(loadPalette)
const HINT_DISMISSED = 'gmm:hint-dismissed'
const NIGHT_OFF = 'gmm:night-off'
// "Surprise me" picks from places with something to play.
const surprising = countries.filter((country) => country.chart || country.genres.length > 0)

export default function App() {
  const selection = useSelection()
  const country = selection.country ? (countriesByIso2.get(selection.country) ?? null) : null
  // Curated countries auto-select their first genre, so the Sounds tab always has records loading.
  const genre = country?.genres.length ? (country.genres.find((g) => g.id === selection.genre) ?? country.genres[0]) : null
  const places = usePlaces(country)
  const city = (selection.city && places.data?.cities.find((c) => c.id === selection.city)) || null
  // Keep showing the city while its country's places load; drop unknown ids.
  const cityId = selection.city && (city || places.isPending) ? selection.city : null
  // A town or village without music data: the globe points at it and the panel says what's nearest.
  const gazetteer = useGazetteer(!!selection.place)
  const placeEntry = selection.place ? gazetteer.data?.byId.get(selection.place) : undefined
  const place = placeEntry && country && placeEntry.iso2 === country.iso2 && !cityId ? placeEntry : null
  const queryClient = useQueryClient()

  // The global panel: Shazam's chart right now, or the all-time Top 30.
  const globalOpen = !country && !!selection.view
  const allTimeOpen = globalOpen && selection.view === 'alltime'
  // Shares its cache with the panel; here it lights up the countries the hits come from.
  const globalChart = useGlobalChart(globalOpen && !allTimeOpen)
  const allTime = useAllTime(allTimeOpen)
  // The quiz: while a "Where?" round waits for an answer, clicks on the globe are guesses.
  const quiz = useQuiz()
  const [quizOpen, setQuizOpen] = useState(false)
  const guessing = quizOpen && quiz.status === 'playing' && quiz.mode === 'where'
  const revealed = quizOpen && quiz.status === 'revealed' ? quiz.current?.answer.country : undefined

  // "Where else is this song charting?": every national chart, loaded the first time someone asks.
  const [spotlight, setSpotlight] = useState<SpotlightTrack | null>(null)
  // A searched number-one song or artist: where and when it was number one, from the time machine's hits.
  const [card, setCard] = useState<{ kind: 'song'; song: SongRef; from?: ArtistRef } | { kind: 'artist'; artist: ArtistRef } | null>(null)
  // A card lights up the countries of its number ones, from the song index.
  const songIndex = useSongIndex(!!card)
  // The year and song the hits tab should open on, after picking one in the song card.
  const [hitFocus, setHitFocus] = useState<{ iso2: string; year: number; key: string } | null>(null)
  // Musical neighbours: which countries' charts are most like the selected country's.
  const [similarityOn, setSimilarityOn] = useState(false)
  const chartIndex = useChartIndex(!!spotlight || (similarityOn && !!country))
  const neighbourList = useMemo(
    () => (similarityOn && country ? neighbours(chartIndex.data, country.iso2) : []),
    [similarityOn, country, chartIndex.data],
  )
  const similarity = useMemo(() => {
    if (!neighbourList.length) return null
    return new Map(neighbourList.flatMap(({ iso2, share }) => {
      const id = countriesByIso2.get(iso2.toLowerCase())?.id
      return id ? [[id, share] as const] : []
    }))
  }, [neighbourList])
  const positions = useMemo(
    () => (spotlight ? chartPositions(chartIndex.data, songKey(spotlight.artist, spotlight.title)) : []),
    [spotlight, chartIndex.data],
  )

  // Countries to light up: where the spotlit song is charting, where a searched song or artist was number
  // one, else where the Top 100's artists come from.
  const charting = useMemo(() => {
    if (revealed) return new Set([revealed.id])
    if (spotlight) {
      return new Set(positions.flatMap(({ iso2 }) => countriesByIso2.get(iso2.toLowerCase())?.id ?? []))
    }
    if (card) {
      const id = (iso2: string) => countriesByIso2.get(iso2.toLowerCase())?.id ?? []
      if (card.kind === 'song') {
        const hit = card.song.hit ?? songIndex.data?.byKey.get(anySongKey(card.song.title, card.song.artist))
        return new Set(hit?.entries.flatMap(([iso2]) => id(iso2)) ?? [])
      }
      const { origin, name, hits = songIndex.data?.byName.get(nameKey(name)) } = card.artist
      return new Set([...(origin ? [origin.iso2] : []), ...(hits?.songs.flatMap((song) => song.entries.map(([iso2]) => iso2)) ?? [])].flatMap(id))
    }
    if (!globalOpen) return undefined
    if (allTimeOpen) return new Set((allTime.data ?? []).flatMap((song) => (song.origin ? (countriesByIso2.get(song.origin.iso2.toLowerCase())?.id ?? []) : [])))
    const tracks = globalChart.data?.pages.flatMap((page) => page.tracks) ?? []
    return new Set(originCounts(tracks).map(({ country: c }) => c.id))
  }, [revealed, spotlight, positions, card, songIndex.data, globalOpen, allTimeOpen, allTime.data, globalChart.data])

  // Time machine: a decade (1840 = before 1850), or null when it's closed.
  const [decade, setDecade] = useDecade()
  const { data: timeline } = useTimeline(decade !== null)

  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [tab, setTab] = useState<PanelTab>(() => (selection.genre ? 'sounds' : 'charts'))
  const [layers, setLayers] = useState<Layers>({ music: true, films: true })
  const [zoomedIn, setZoomedIn] = useState(false)
  const [night, setNight] = useState(() => !readFlag(NIGHT_OFF))
  const toggleNight = useCallback(() => {
    setNight((on) => {
      if (on) writeFlag(NIGHT_OFF)
      else clearFlag(NIGHT_OFF)
      return !on
    })
  }, [])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteRequested, setPaletteRequested] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  // Deep links count as "already found the way around".
  const [hintDismissed, setHintDismissed] = useState(() => readFlag(HINT_DISMISSED) || !!selection.country || !!selection.view)
  const globeRef = useRef<GlobeHandle>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    setAccentHue(country?.hue ?? DEFAULT_HUE)
  }, [country])

  // Warm the palette chunk once the browser is idle, so ⌘K opens instantly.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1500))
    idle(() => void loadPalette())
  }, [])

  const dismissHint = useCallback(() => {
    setHintDismissed(true)
    writeFlag(HINT_DISMISSED)
  }, [])

  const { select, clear, showView } = selection
  const openCountry = useCallback(
    (iso2: string, options: { genre?: string; city?: string; place?: string } = {}) => {
      // Remember where focus was (the globe, the search button…) to restore it on close.
      if (!selection.country && document.activeElement && document.activeElement !== document.body) {
        returnFocusRef.current = document.activeElement
      }
      dismissHint()
      if (options.genre) setTab('sounds')
      select(iso2, { genre: options.genre ?? null, city: options.city ?? null, place: options.place ?? null })
    },
    [select, selection.country, dismissHint],
  )

  const closeCountry = useCallback(() => {
    clear()
    setSimilarityOn(false)
    const target = returnFocusRef.current
    returnFocusRef.current = null
    requestAnimationFrame(() => {
      const element = target?.isConnected ? target : searchButtonRef.current
      ;(element as HTMLElement | SVGElement | null)?.focus({ preventScroll: true })
    })
  }, [clear])

  const selectCity = useCallback((next: City | null) => country && select(country.iso2, { city: next?.id ?? null }), [country, select])
  const openCity = useCallback((target: Country, next: City) => openCountry(target.iso2, { city: next.id }), [openCountry])
  /** A searched or clicked town opens as its music city when it is one (Pécs), else as a place. */
  const openPlace = useCallback(
    async (settlement: Settlement) => {
      const target = countriesByIso2.get(settlement.iso2.toLowerCase())
      if (!target) return
      let match: City | undefined
      if (target.cityCount > 0) {
        const data = await queryClient.fetchQuery(placesQuery(target.iso2)).catch(() => undefined)
        match = data && cityFor(settlement, data.cities)
      }
      openCountry(target.iso2, match ? { city: match.id } : { place: settlement.id })
    },
    [queryClient, openCountry],
  )

  const selectGenre = useCallback((next: Genre) => country && select(country.iso2, { genre: next.id }), [country, select])

  const surprise = useCallback(() => {
    const next = pickRandom(surprising, country ?? undefined)
    setTab('charts')
    openCountry(next.iso2)
  }, [country, openCountry])

  const showSong = useCallback((song: SongRef, from?: ArtistRef) => {
    setSpotlight(null)
    setCard({ kind: 'song', song, from })
  }, [])
  const showArtist = useCallback((artist: ArtistRef) => {
    setSpotlight(null)
    setCard({ kind: 'artist', artist })
  }, [])
  /**
   * From the artist card: their birthplace (or where the band formed) on the globe: as a music city when
   * it is one, else as a town from the gazetteer, else just the country.
   */
  const openOrigin = useCallback(
    async (origin: ArtistMatch) => {
      if (!countriesByIso2.has(origin.iso2.toLowerCase())) return
      if (origin.cityId) {
        const places = await queryClient.fetchQuery(placesQuery(origin.iso2)).catch(() => undefined)
        if (places?.cities.some((c) => c.id === origin.cityId)) return openCountry(origin.iso2, { city: origin.cityId })
        const settlement = (await queryClient.fetchQuery(gazetteerQuery()).catch(() => undefined))?.byId.get(origin.cityId)
        if (settlement?.iso2 === origin.iso2) return openCountry(origin.iso2, { place: settlement.id })
      }
      openCountry(origin.iso2)
    },
    [queryClient, openCountry],
  )
  /** From the artist card: the time machine at one of their decades, with their country's number ones then. */
  const openArtistDecade = useCallback(
    (artist: ArtistRef, decade: number) => {
      setDecade(decade)
      if (!artist.origin) return
      setTab('charts')
      openCountry(artist.origin.iso2)
    },
    [setDecade, openCountry],
  )
  /** From the song card: that country's number ones of that year, in the time machine, with the song picked out. */
  const openHit = useCallback(
    (song: SongHit, [iso2, year]: SongEntry) => {
      setDecade(Math.floor(year / 10) * 10)
      setHitFocus({ iso2, year, key: anySongKey(song.title, song.artist) })
      setTab('charts')
      openCountry(iso2)
    },
    [setDecade, openCountry],
  )

  const openGlobalChart = useCallback(() => {
    dismissHint()
    showView('top100')
  }, [dismissHint, showView])

  const openQuiz = useCallback(() => {
    dismissHint()
    // The quiz needs the globe to itself: no open panel, spotlight or time machine to give hints.
    clear()
    setSpotlight(null)
    setCard(null)
    setDecade(null)
    setQuizOpen(true)
  }, [dismissHint, clear, setDecade])

  const closeQuiz = useCallback(() => {
    quiz.stop()
    setQuizOpen(false)
  }, [quiz])

  const openPalette = useCallback(() => {
    setPaletteRequested(true)
    setPaletteOpen(true)
  }, [])

  useHotkeys({
    onSearch: () => (paletteOpen ? setPaletteOpen(false) : openPalette()),
    onHelp: () => setAboutOpen(true),
    onEscape: () => {
      if (paletteOpen || aboutOpen) return
      if (quizOpen) closeQuiz()
      else if (cityId || place) selectCity(null)
      else if (country || globalOpen) closeCountry()
    },
  })

  const panelOpen = !!country || globalOpen
  const showMode = (mode: ChartMode) => showView(mode === 'now' ? 'top100' : 'alltime')
  const globalContent = (scrollLocked: boolean) =>
    allTimeOpen ? (
      <AllTimeContent
        key="alltime"
        onClose={closeCountry}
        onMode={showMode}
        onOpenCountry={(next) => openCountry(next.iso2)}
        onSong={(song) => showSong(song)}
        onArtist={showArtist}
        scrollLocked={scrollLocked}
      />
    ) : (
      <GlobalChartContent key="now" onClose={closeCountry} onMode={showMode} onOpenCountry={(next) => openCountry(next.iso2)} scrollLocked={scrollLocked} />
    )
  const chromeOffset = panelOpen && isDesktop
  const panelProps = {
    country: country!,
    city,
    cityId,
    place,
    genre,
    tab,
    onTab: setTab,
    onSelectGenre: selectGenre,
    onSelectCity: selectCity,
    onClose: closeCountry,
    decade,
    onClearDecade: () => setDecade(null),
    onDecade: setDecade,
    hitFocus: hitFocus && country && hitFocus.iso2 === country.iso2 ? hitFocus : null,
    similarity: {
      on: similarityOn,
      list: neighbourList,
      loading: chartIndex.isFetching,
      failed: chartIndex.isError,
      complete: chartIndex.data?.complete ?? true,
      onToggle: () => setSimilarityOn((on) => !on),
    },
    onOpenCountry: (next: Country) => openCountry(next.iso2),
  }

  return (
    <SpotlightContext value={setSpotlight}>
      <div className="relative h-dvh w-full overflow-hidden">
        <Globe
          ref={globeRef}
          selected={country}
          city={city}
          place={place}
          onSelectPlace={(settlement: Settlement) => void openPlace(settlement)}
          isDesktop={isDesktop}
          layers={layers}
          onSelect={(next: Country) => (guessing ? quiz.guessCountry(next) : openCountry(next.iso2))}
          onSelectCity={(target: Country, next: City) => (guessing ? quiz.guessCountry(target) : openCity(target, next))}
          onClear={closeCountry}
          onInteract={dismissHint}
          onZoomedIn={setZoomedIn}
          charting={charting}
          panelOpen={globalOpen}
          night={night}
          decade={decade}
          timeline={timeline}
          similarity={similarity}
        />

        {/* Floating UI. On desktop it makes room for the panel by moving its right edge. */}
        <div
          className="pointer-events-none fixed inset-y-0 left-0 z-20 transition-[right] duration-500 ease-out-soft"
          style={{ right: chromeOffset ? 'calc(var(--panel-w) + 24px)' : 0 }}
        >
          <TopBar
            searchRef={searchButtonRef}
            onSearch={openPalette}
            onGlobalChart={openGlobalChart}
            onTimeMachine={() => {
              dismissHint()
              setDecade(decade === null ? 1960 : null)
            }}
            timeMachineOpen={decade !== null}
            onQuiz={() => (quizOpen ? closeQuiz() : openQuiz())}
            quizOpen={quizOpen}
            onSurprise={surprise}
            onAbout={() => setAboutOpen(true)}
          />
          <Legend layers={layers} onLayers={setLayers} showLayers={zoomedIn || decade !== null} />
          <MapControls
            onZoomIn={() => globeRef.current?.zoomIn()}
            onZoomOut={() => globeRef.current?.zoomOut()}
            onReset={() => globeRef.current?.reset()}
            night={night}
            onToggleNight={toggleNight}
          />
          <OnboardingHint visible={!hintDismissed && !panelOpen && decade === null && !quizOpen} onDismiss={dismissHint} />
          {/* On desktop the open panel docks the player at its foot instead. */}
          {/* Under the top bar: the time machine, and on phones the preview player. */}
          <div className="absolute inset-x-0 top-16 flex flex-col items-center gap-2 px-3 md:top-[72px]">
            <AnimatePresence>
              {quizOpen && <QuizCard key="quiz" quiz={quiz} onClose={closeQuiz} />}
              {decade !== null && (
                <TimeMachine key="time-machine" timeline={timeline} decade={decade} layers={layers} onDecade={setDecade} onClose={() => setDecade(null)} />
              )}
              {spotlight && (
                <SongSpotlight
                  key={`spotlight-${spotlight.artist}-${spotlight.title}`}
                  track={spotlight}
                  index={chartIndex.data}
                  positions={positions}
                  loading={chartIndex.isFetching}
                  failed={chartIndex.isError}
                  onOpenCountry={(next) => openCountry(next.iso2)}
                  onShowOnGlobe={() => globeRef.current?.overview()}
                  onClose={() => setSpotlight(null)}
                />
              )}
              {card?.kind === 'song' && (
                <SongCard
                  key={`song-${card.song.track ?? `${card.song.artist}-${card.song.title}`}`}
                  song={card.song}
                  from={card.from}
                  onOpen={openHit}
                  onArtist={showArtist}
                  onShowOnGlobe={() => globeRef.current?.overview()}
                  onClose={() => setCard(null)}
                />
              )}
              {card?.kind === 'artist' && (
                <ArtistCard
                  key={`artist-${card.artist.origin?.id ?? card.artist.name}`}
                  artist={card.artist}
                  onOpenOrigin={(origin) => void openOrigin(origin)}
                  onDecade={(decade) => openArtistDecade(card.artist, decade)}
                  onSong={(song) => showSong({ title: song.title, artist: song.artist, hit: song }, card.artist)}
                  onShowOnGlobe={() => globeRef.current?.overview()}
                  onClose={() => setCard(null)}
                />
              )}
            </AnimatePresence>
            {!isDesktop && <MiniPlayer className="flex justify-center" />}
          </div>
          {/* On desktop the player floats at the bottom, or docks in the open panel. */}
          {isDesktop && !panelOpen && <MiniPlayer className="absolute inset-x-0 bottom-5 flex justify-center px-3" />}
        </div>

        <AnimatePresence>
          {country &&
            (isDesktop ? <CountryPanel key="panel" {...panelProps} /> : <CountrySheet key="sheet" {...panelProps} />)}
          {globalOpen &&
            (isDesktop ? (
              <PanelFrame key="global-panel" labelledBy="global-heading">
                {globalContent(false)}
              </PanelFrame>
            ) : (
              <SheetFrame key="global-sheet" labelledBy="global-heading" onClose={closeCountry}>
                {(scrollLocked) => globalContent(scrollLocked)}
              </SheetFrame>
            ))}
        </AnimatePresence>

        {paletteRequested && (
          <Suspense fallback={null}>
            <CommandPalette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              onSelect={openCountry}
              onSelectPlace={(settlement: Settlement) => void openPlace(settlement)}
              onSelectSong={(song: SongRef) => showSong(song)}
              onSelectArtist={showArtist}
            />
          </Suspense>
        )}
        <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </div>
    </SpotlightContext>
  )
}
