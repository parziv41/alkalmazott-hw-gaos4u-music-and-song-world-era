import { ArrowLeft, Clapperboard, Disc3, Music2, Radio, X } from 'lucide-react'
import { AnimatePresence, motion, useInView, type Variants } from 'motion/react'
import { useEffect, useRef } from 'react'
import { usePlaces } from '../../hooks/usePlaces'
import type { Country, Genre } from '../../types/music'
import type { City, Settlement } from '../../types/places'
import { useI18n } from '../../i18n/context'
import type { Messages } from '../../i18n/en'
import { cn } from '../../utils/misc'
import { Flag } from '../UI/Flag'
import { IconButton } from '../UI/IconButton'
import { Tabs, type TabItem } from '../UI/Tabs'
import { ChartTab } from './ChartTab'
import { HitsTab } from './HitsTab'
import type { SimilarityState } from './Neighbours'
import { PlaceBanner } from './PlaceBanner'
import { ArtistsTab, FilmsTab } from './PlaceTabs'
import { SoundsTab } from './SoundsTab'

export type PanelTab = 'charts' | 'artists' | 'films' | 'sounds'

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
}

export type CountryContentProps = {
  country: Country
  /** Set when a city is open; `cityId` alone while the country's places are still loading. */
  city: City | null
  cityId: string | null
  /** A town or village the globe is pointing at (from search or its label). */
  place?: Settlement | null
  genre: Genre | null
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  onSelectGenre: (genre: Genre) => void
  onSelectCity: (city: City | null) => void
  onClose: () => void
  /** Mobile sheet at peek height: the sheet itself moves, so the content doesn't scroll. */
  scrollLocked?: boolean
  /** The time machine's decade: the chart tab shows that decade's number ones, Artists and Films are filtered. */
  decade?: number | null
  onClearDecade?: () => void
  onDecade?: (decade: number) => void
  /** A year and song to open the hits tab on (from the song card). */
  hitFocus?: { year: number; key: string } | null
  /** The similarity map ("musical neighbours") for this country's chart. */
  similarity?: SimilarityState
  onOpenCountry?: (country: Country) => void
}

const credits = ({ panel: { credits: c } }: Messages, past: boolean): Record<PanelTab, { label: string; href: string }[]> => ({
  charts: [
    past ? { label: c.hits, href: 'https://en.wikipedia.org/wiki/Category:Lists_of_number-one_songs' } : { label: c.charts, href: 'https://www.shazam.com/charts' },
    { label: c.previews, href: 'https://www.deezer.com' },
  ],
  artists: [
    { label: c.wikidata, href: 'https://www.wikidata.org' },
    { label: c.previews, href: 'https://www.deezer.com' },
  ],
  films: [{ label: c.wikidata, href: 'https://www.wikidata.org' }],
  sounds: [{ label: c.discogs, href: 'https://www.discogs.com' }],
})

/** Everything about one country or city. Shared by the desktop panel and the mobile sheet. */
export function CountryContent({
  country,
  city,
  cityId,
  place = null,
  genre,
  tab,
  onTab,
  onSelectGenre,
  onSelectCity,
  onClose,
  scrollLocked = false,
  decade = null,
  onClearDecade = () => {},
  onDecade = () => {},
  hitFocus = null,
  similarity,
  onOpenCountry,
}: CountryContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const heroVisible = useInView(heroRef, { root: scrollRef, initial: true, margin: '-56px 0px 0px 0px' })
  const places = usePlaces(country)
  const inCity = !!cityId

  // Move focus into the panel so keyboard and screen-reader users land on the new place.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [cityId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [cityId])

  const { t, countryName, regionName, description } = useI18n()
  const tabs: TabItem<PanelTab>[] = [
    { id: 'charts', label: decade === null ? t.panel.tabs.charts : t.hits.tab, icon: <Radio /> },
    { id: 'artists', label: t.panel.tabs.artists, icon: <Music2 /> },
    { id: 'films', label: t.panel.tabs.films, icon: <Clapperboard /> },
    ...(!inCity && genre ? [{ id: 'sounds' as const, label: t.panel.tabs.sounds, icon: <Disc3 /> }] : []),
  ]
  const activeTab = tabs.some((item) => item.id === tab) ? tab : 'charts'
  const name = countryName(country)
  const heading = inCity ? (city?.name ?? '…') : name
  const intro = description(country)
  const counts = city
    ? [t.common.artists(city.artists.length), t.common.films(city.films.length), city.chart && t.common.cityChart].filter(Boolean).join(' · ')
    : [regionName(country.region), country.genres.length > 0 && t.common.sounds(country.genres.length), country.cityCount > 0 && t.common.cities(country.cityCount)]
        .filter(Boolean)
        .join(' · ')

  return (
    <motion.div
      className="relative flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22 }}
    >
      {/* Compact header once the hero has scrolled away. */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-900/85 px-5 backdrop-blur-xl transition duration-300',
          heroVisible ? 'pointer-events-none -translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
        )}
        aria-hidden={heroVisible}
      >
        <Flag iso2={country.iso2} className="h-4 w-6 rounded-[3px] ring-1 ring-white/15" />
        <span className="flex-1 truncate font-display text-[22px] leading-none">{heading}</span>
        <IconButton label={t.common.close} variant="ghost" onClick={onClose} tabIndex={heroVisible ? -1 : 0}>
          <X />
        </IconButton>
      </div>

      <div
        ref={scrollRef}
        className={cn('scroll-thin min-h-0 flex-1 overscroll-contain', scrollLocked ? 'overflow-hidden' : 'overflow-y-auto')}
      >
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.045 }}>
          <motion.header variants={sectionVariants} ref={heroRef} className="relative overflow-hidden px-6 pb-4 pt-6">
            <div aria-hidden className="hero-mesh absolute inset-0" />
            <div className="relative flex items-start justify-between">
              {inCity ? (
                <button
                  type="button"
                  onClick={() => onSelectCity(null)}
                  className="-ml-1 inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[13px] text-mid ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-hi"
                >
                  <ArrowLeft className="size-4" />
                  <Flag iso2={country.iso2} className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-white/15" />
                  {name}
                </button>
              ) : (
                <Flag iso2={country.iso2} className="h-8 w-12 rounded-[5px] shadow-lg shadow-black/40 ring-1 ring-white/15" />
              )}
              <IconButton label={t.common.close} variant="ghost" onClick={onClose} className="-mr-2 -mt-2">
                <X />
              </IconButton>
            </div>
            <p className="label-mono relative mt-6">{counts}</p>
            <h2
              id="country-heading"
              ref={headingRef}
              tabIndex={-1}
              className="relative mt-1 font-display text-[44px] leading-[48px] tracking-[-0.01em] outline-none"
            >
              {heading}
            </h2>
          </motion.header>

          {/* Clamped at peek height so the tabs stay in view on phones. */}
          {!inCity && intro && (
            <motion.p variants={sectionVariants} className={cn('px-6 text-[15px] leading-6 text-mid', scrollLocked && 'line-clamp-2')}>
              {intro}
            </motion.p>
          )}

          {!inCity && place && (
            <PlaceBanner
              key={place.id}
              place={place}
              cities={places.data?.cities ?? []}
              onSelectCity={onSelectCity}
              onClear={() => onSelectCity(null)}
            />
          )}

          <motion.div variants={sectionVariants} className="sticky top-0 z-[5] mt-5 bg-gradient-to-b from-ink-900/90 to-ink-900/0 px-6 pb-3 pt-1">
            <Tabs items={tabs} value={activeTab} onChange={onTab} label={t.panel.tabsLabel} idPrefix="panel" />
          </motion.div>

          <motion.div
            variants={sectionVariants}
            id="panel-panel"
            role="tabpanel"
            aria-labelledby={`panel-tab-${activeTab}`}
            className="mt-3 px-6"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${activeTab}-${cityId ?? ''}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                {activeTab === 'charts' && decade !== null && (
                  <HitsTab
                    key={hitFocus ? `${hitFocus.year}|${hitFocus.key}` : 'hits'}
                    focus={hitFocus}
                    country={country}
                    city={city}
                    decade={decade}
                    onDecade={onDecade}
                    onShowArtists={() => onTab('artists')}
                    onToday={onClearDecade}
                  />
                )}
                {activeTab === 'charts' && decade === null && (
                  <ChartTab
                    key={cityId ?? 'country'}
                    country={country}
                    city={city}
                    places={places.data}
                    onSelectCity={onSelectCity}
                    onShowArtists={() => onTab('artists')}
                    similarity={similarity}
                    onOpenCountry={onOpenCountry}
                  />
                )}
                {activeTab === 'artists' && (
                  <ArtistsTab
                    country={country}
                    city={city}
                    places={places.data}
                    loading={places.isPending && country.cityCount > 0}
                    onSelectCity={onSelectCity}
                    decade={decade}
                    onClearDecade={onClearDecade}
                  />
                )}
                {activeTab === 'films' && (
                  <FilmsTab
                    country={country}
                    city={city}
                    places={places.data}
                    loading={places.isPending && country.cityCount > 0}
                    onSelectCity={onSelectCity}
                    decade={decade}
                    onClearDecade={onClearDecade}
                  />
                )}
                {activeTab === 'sounds' && genre && <SoundsTab country={country} genre={genre} onSelectGenre={onSelectGenre} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.footer
            variants={sectionVariants}
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-[12px]"
          >
            {credits(t, decade !== null)[activeTab].map((credit) => (
              <a key={credit.label} href={credit.href} target="_blank" rel="noopener noreferrer" className="text-lo hover:text-mid">
                {credit.label}
              </a>
            ))}
          </motion.footer>
        </motion.div>
      </div>
    </motion.div>
  )
}
