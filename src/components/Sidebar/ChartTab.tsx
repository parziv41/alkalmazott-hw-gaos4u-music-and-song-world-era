import { ArrowLeftRight, ArrowUpRight, CloudOff, MapPin, Radio, RotateCw, Waypoints } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useDelayedFlag } from '../../hooks/dom'
import { ChartError, chartTargetFor, useChart } from '../../hooks/useChart'
import type { Chart, ChartTrack } from '../../types/charts'
import type { Country } from '../../types/music'
import type { City, CountryPlaces } from '../../types/places'
import { useI18n } from '../../i18n/context'
import type { Messages } from '../../i18n/en'
import { cn } from '../../utils/misc'
import { CoverImage } from '../UI/CoverImage'
import { StateMessage } from '../UI/StateMessage'
import { nationalPlaceFor, placeName, type ChartPlace } from '../../utils/chartPlaces'
import { ComparePicker, CompareView, TrackActions } from './CompareCharts'
import { Neighbours, type SimilarityState } from './Neighbours'

const FIRST_PAGE = 10

type ChartTabProps = {
  country: Country
  city: City | null
  places?: CountryPlaces
  onSelectCity: (city: City | null) => void
  onShowArtists: () => void
  similarity?: SimilarityState
  onOpenCountry?: (country: Country) => void
}

function describe(t: Messages, chart: Chart | undefined, scope: 'city' | 'country', countryName: string, country: Country, city: City | null) {
  const where = scope === 'city' && city ? city.name : countryName
  const source = chart?.source ?? (scope === 'city' || country.chart === 'shazam' ? 'shazam' : 'apple')
  const period = t.chart.period(chart?.period, source)
  return source === 'shazam'
    ? { title: t.chart.mostShazamed(where), credit: t.chart.shazam(period) }
    : { title: t.chart.topSongs(where), credit: t.chart.apple(period) }
}

/** What a country or city is listening to right now. */
export function ChartTab({ country, city, places, onSelectCity, onShowArtists, similarity, onOpenCountry }: ChartTabProps) {
  const { t, countryName } = useI18n()
  const name = countryName(country)
  const cityTarget = city?.chart ? chartTargetFor(country, city) : null
  const [preferCountry, setPreferCountry] = useState(false)
  const target = cityTarget && !preferCountry ? cityTarget : chartTargetFor(country)
  const scope = target?.scope ?? 'country'
  const query = useChart(target)
  const showLoader = useDelayedFlag(query.isPending && !!target, 120)
  const [expanded, setExpanded] = useState(false)
  const chartCities = (places?.cities ?? []).filter((c) => c.chart)
  const { title, credit } = describe(t, query.data, scope, name, country, city)
  // Comparing: first pick a place, then both charts as one list.
  const [compare, setCompare] = useState<'off' | 'picking' | ChartPlace>('off')
  const here = scope === 'city' && city ? city.name : name
  const hereKey = scope === 'city' && city?.chart ? `city:${country.iso2}:${city.chart}` : `country:${country.iso2}`

  if (!target) {
    return (
      <StateMessage
        icon={<Radio />}
        title={t.chart.noChart}
        action={
          country.artistCount > 0 ? (
            <button type="button" onClick={onShowArtists} className="text-[13px] font-medium text-accent hover:underline">
              {t.chart.hearArtists(name)}
            </button>
          ) : undefined
        }
      >
        {t.chart.noChartText(name)}
      </StateMessage>
    )
  }

  const tracks = query.data?.tracks ?? []
  const shown = expanded ? tracks : tracks.slice(0, FIRST_PAGE)
  const notFound = query.error instanceof ChartError && query.error.status === 404

  return (
    <section aria-labelledby="chart-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="chart-heading" className="font-display text-[26px] leading-8">
            {title}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-lo">{credit}</p>
        </div>
        {cityTarget && city && (
          <div role="group" aria-label={t.chart.area} className="flex shrink-0 rounded-full bg-white/[0.05] p-0.5 text-[12px] ring-1 ring-white/10">
            {[
              { id: false, label: city.name },
              { id: true, label: t.chart.national },
            ].map((option) => (
              <button
                key={String(option.id)}
                type="button"
                aria-pressed={preferCountry === option.id}
                onClick={() => setPreferCountry(option.id)}
                className={cn(
                  'max-w-[110px] truncate rounded-full px-2.5 py-1 font-medium transition',
                  preferCountry === option.id ? 'bg-accent text-on-accent' : 'text-mid hover:text-hi',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {city && !city.chart && (
        <p className="mt-3 flex gap-2 rounded-xl bg-white/[0.035] px-3 py-2.5 text-[12.5px] leading-5 text-mid ring-1 ring-white/[0.06]">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>
            {t.chart.noCityChart(city.name, name)}
          </span>
        </p>
      )}

      {compare === 'off' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCompare('picking')}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10 [&_svg]:size-3.5"
          >
            <ArrowLeftRight className="text-accent" /> {t.chart.compare}
          </button>
          {similarity && !similarity.on && (
            <button
              type="button"
              onClick={similarity.onToggle}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10 [&_svg]:size-3.5"
            >
              <Waypoints className="text-accent" /> {t.chart.whoListens(name)}
            </button>
          )}
        </div>
      )}
      {compare === 'off' && similarity?.on && (
        <Neighbours
          country={country}
          similarity={similarity}
          onOpenCountry={(other) => onOpenCountry?.(other)}
          onCompare={(iso2) => {
            const place = nationalPlaceFor(iso2)
            if (place) setCompare(place)
          }}
        />
      )}
      {compare === 'picking' && <ComparePicker current={hereKey} onPick={setCompare} onCancel={() => setCompare('off')} />}
      {typeof compare === 'object' && target && (
        <CompareView a={{ name: here, target }} b={{ name: placeName(compare, countryName), target: compare.target }} onClose={() => setCompare('off')} />
      )}

      {compare === 'off' && !city && chartCities.length > 0 && (
        <div className="mt-3">
          <p className="label-mono mb-2">{t.chart.cityCharts}</p>
          <div className="flex flex-wrap gap-1.5">
            {chartCities.map((chartCity) => (
              <button
                key={chartCity.id}
                type="button"
                onClick={() => onSelectCity(chartCity)}
                className="rounded-full bg-white/[0.05] px-3 py-1 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10"
              >
                {chartCity.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn('mt-4 min-h-[300px]', compare !== 'off' && 'hidden')}>
        <AnimatePresence mode="wait" initial={false}>
          {query.isPending ? (
            <motion.ol key="loading" initial={{ opacity: 0 }} animate={{ opacity: showLoader ? 1 : 0 }} exit={{ opacity: 0 }} aria-hidden>
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="grid grid-cols-[22px_48px_1fr] items-center gap-3 px-2 py-1.5">
                  <div className="skeleton h-2.5 w-4 rounded-full" />
                  <div className="skeleton size-12 rounded-lg" />
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded-full" />
                    <div className="skeleton h-2.5 w-1/2 rounded-full" />
                  </div>
                </li>
              ))}
            </motion.ol>
          ) : query.isError ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StateMessage
                icon={notFound ? <Radio /> : <CloudOff />}
                title={notFound ? t.chart.empty : t.chart.failed}
                action={
                  notFound ? undefined : (
                    <button
                      type="button"
                      onClick={() => query.refetch()}
                      className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-hi ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <RotateCw className="size-3.5" /> {t.common.tryAgain}
                    </button>
                  )
                }
              >
                {notFound ? t.chart.emptyText : t.chart.failedText}
              </StateMessage>
            </motion.div>
          ) : (
            <motion.div key={JSON.stringify(target.params)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ol className="-mx-2" aria-label={title}>
                {shown.map((track) => (
                  <TrackRow key={`${track.rank}-${track.title}`} track={track} />
                ))}
              </ol>
              {tracks.length > FIRST_PAGE && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-2 w-full rounded-xl py-2 text-[13px] font-medium text-accent transition hover:bg-white/[0.04]"
                >
                  {expanded ? t.chart.showTop10 : t.common.showAll(tracks.length)}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function TrackRow({ track }: { track: ChartTrack }) {
  const { t } = useI18n()
  return (
    <li className="group grid grid-cols-[22px_48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]">
      <span className="text-right font-mono text-[11px] text-lo">{track.rank}</span>
      <CoverImage src={track.artwork} className="relative size-12 rounded-lg ring-1 ring-white/10" />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-5 text-hi">{track.title}</p>
        <p className="truncate text-[12.5px] leading-5 text-mid">{track.artist}</p>
      </div>
      <div className="flex items-center gap-1">
        <TrackActions track={track} />
        {track.url && (
          <a
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.chart.open(track.title)}
            className="grid size-8 place-items-center rounded-full text-lo transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 hover:bg-white/10 hover:text-hi focus-visible:opacity-100 [&_svg]:size-4"
          >
            <ArrowUpRight />
          </a>
        )}
      </div>
    </li>
  )
}
