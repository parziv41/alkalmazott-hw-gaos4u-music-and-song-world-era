import { CloudOff, Earth, RotateCw, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { countriesByIso2 } from '../../data'
import { GLOBAL_TOP, useGlobalChart } from '../../hooks/useChart'
import { useI18n } from '../../i18n/context'
import { originCounts } from '../../utils/chartOrigins'
import type { ChartTrack } from '../../types/charts'
import type { Country } from '../../types/music'
import { cn } from '../../utils/misc'
import { CoverImage } from '../UI/CoverImage'
import { Flag } from '../UI/Flag'
import { IconButton } from '../UI/IconButton'
import { StateMessage } from '../UI/StateMessage'
import { ChartModeSwitch, type ChartMode } from './ChartModeSwitch'
import { TrackActions } from './CompareCharts'

type GlobalChartContentProps = {
  onClose: () => void
  onMode: (mode: ChartMode) => void
  onOpenCountry: (country: Country) => void
  scrollLocked?: boolean
}

/** Shazam's global top 100: what the whole world is listening to, and where it comes from. */
export function GlobalChartContent({ onClose, onMode, onOpenCountry, scrollLocked = false }: GlobalChartContentProps) {
  const query = useGlobalChart(true)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const tracks = useMemo(() => query.data?.pages.flatMap((page) => page.tracks) ?? [], [query.data])
  const origins = useMemo(() => originCounts(tracks), [tracks])
  const { t, countryName } = useI18n()
  const period = t.chart.period(query.data?.pages[0]?.period, 'shazam')
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  // Load the rest of the top 100 a page at a time once the first 25 are on screen.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage, tracks.length])

  return (
    <motion.div
      className="relative flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
    >
      <div className={cn('scroll-thin min-h-0 flex-1 overscroll-contain', scrollLocked ? 'overflow-hidden' : 'overflow-y-auto')}>
        <header className="relative overflow-hidden px-6 pb-4 pt-6">
          <div aria-hidden className="hero-mesh absolute inset-0" />
          <div className="relative flex items-start justify-between">
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent ring-1 ring-white/10 [&_svg]:size-6">
              <Earth />
            </span>
            <IconButton label={t.common.close} variant="ghost" onClick={onClose} className="-mr-2 -mt-2">
              <X />
            </IconButton>
          </div>
          <div className="relative mt-4">
            <ChartModeSwitch mode="now" onMode={onMode} />
          </div>
          <p className="label-mono relative mt-4">{t.chart.shazam(period)}</p>
          <h2
            id="global-heading"
            ref={headingRef}
            tabIndex={-1}
            className="relative mt-1 font-display text-[44px] leading-[48px] tracking-[-0.01em] outline-none"
          >
            {t.top100.heading}
          </h2>
          <p className={cn('relative mt-2 text-[14.5px] leading-6 text-mid', scrollLocked && 'line-clamp-2')}>
            {t.top100.intro}
          </p>
        </header>

        {origins.length > 0 && (
          <section aria-labelledby="origins-heading" className="px-6">
            <h3 id="origins-heading" className="label-mono mb-2">
              {t.top100.origins}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {origins.map(({ country, count }) => (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => onOpenCountry(country)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-1.5 pr-2 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <Flag iso2={country.iso2} className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-white/15" />
                  {countryName(country)}
                  <span className="rounded-full bg-white/[0.07] px-1.5 font-mono text-[10.5px] text-mid">{count}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section aria-label={t.top100.heading} className="mt-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {query.isPending ? (
            <ol aria-hidden>
              {Array.from({ length: 8 }, (_, index) => (
                <li key={index} className="grid grid-cols-[22px_48px_1fr] items-center gap-3 px-2 py-1.5">
                  <div className="skeleton h-2.5 w-4 rounded-full" />
                  <div className="skeleton size-12 rounded-lg" />
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded-full" />
                    <div className="skeleton h-2.5 w-1/2 rounded-full" />
                  </div>
                </li>
              ))}
            </ol>
          ) : query.isError && tracks.length === 0 ? (
            <StateMessage
              icon={<CloudOff />}
              title={t.top100.failed}
              action={
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-hi ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <RotateCw className="size-3.5" /> {t.common.tryAgain}
                </button>
              }
            >
              {t.top100.failedText}
            </StateMessage>
          ) : (
            <>
              <ol className="-mx-2" aria-label={t.top100.list}>
                {tracks.map((track) => (
                  <GlobalTrackRow key={`${track.rank}-${track.title}`} track={track} onOpenCountry={onOpenCountry} />
                ))}
              </ol>
              {(isFetchingNextPage || hasNextPage) && (
                <p className="mt-3 text-center text-[12.5px] text-lo" aria-live="polite">
                  {t.top100.loadingMore(tracks.length + 1, Math.min(tracks.length + 25, GLOBAL_TOP))}
                </p>
              )}
              {isError && tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  className="mt-2 w-full rounded-xl py-2 text-[13px] font-medium text-accent transition hover:bg-white/[0.04]"
                >
                  {t.top100.loadMoreFailed}
                </button>
              )}
            </>
          )}
          <p className="mt-6 border-t border-white/[0.06] pt-4 text-[12px] text-lo">
            {t.top100.credits}
          </p>
        </section>
      </div>
    </motion.div>
  )
}

function GlobalTrackRow({ track, onOpenCountry }: { track: ChartTrack; onOpenCountry: (country: Country) => void }) {
  const origin = track.origin ? countriesByIso2.get(track.origin.toLowerCase()) : undefined
  const { t, countryName } = useI18n()
  return (
    <li className="grid grid-cols-[26px_48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]">
      <span className="text-right font-mono text-[11px] text-lo">{track.rank}</span>
      <CoverImage src={track.artwork} className="relative size-12 rounded-lg ring-1 ring-white/10" />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-5 text-hi">{track.title}</p>
        <p className="truncate text-[12.5px] leading-5 text-mid">{track.artist}</p>
        {origin ? (
          <button
            type="button"
            onClick={() => onOpenCountry(origin)}
            className="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-[11.5px] text-lo transition hover:text-accent"
          >
            <Flag iso2={origin.iso2} className="h-2.5 w-[15px] rounded-[2px] ring-1 ring-white/15" />
            <span className="truncate">{countryName(origin)}</span>
          </button>
        ) : (
          <p className="mt-0.5 text-[11.5px] text-lo/70">{t.top100.unknownOrigin}</p>
        )}
      </div>
      <TrackActions track={track} />
    </li>
  )
}
