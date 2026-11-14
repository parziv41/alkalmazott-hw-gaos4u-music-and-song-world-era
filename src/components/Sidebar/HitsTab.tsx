import { ArrowRight, CalendarX2, CloudOff, History, MapPin, Music2, RotateCw, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { hitDecades, useCountryHits, useHitsIndex, wikipediaUrl } from '../../hooks/useHits'
import { useI18n } from '../../i18n/context'
import type { HitSong } from '../../types/hits'
import type { Country } from '../../types/music'
import type { City } from '../../types/places'
import { anySongKey } from '../../utils/hitSearch'
import { cn } from '../../utils/misc'
import { PlayButton } from '../UI/PlayButton'
import { StateMessage } from '../UI/StateMessage'

const FIRST_PAGE = 12

type HitsTabProps = {
  country: Country
  city: City | null
  decade: number
  onDecade: (decade: number) => void
  onShowArtists: () => void
  onToday: () => void
  /** Open on this year, with this song (anySongKey) picked out. */
  focus?: { year: number; key: string } | null
}

/** The time machine's chart tab: a country's number ones, year by year within the decade. */
export function HitsTab({ country, city, decade, onDecade, onShowArtists, onToday, focus = null }: HitsTabProps) {
  const { t, countryName } = useI18n()
  const name = countryName(country)
  const index = useHitsIndex(true)
  const years = index.data?.[country.iso2] ?? []
  const available = decade < 1850 ? [] : years.filter((year) => year >= decade && year < decade + 10)
  const [picked, setPicked] = useState<number | null>(focus?.year ?? null)
  // A year from another decade (the slider moved) falls back to this decade's first.
  const year = picked !== null && available.includes(picked) ? picked : (available[0] ?? null)
  const hits = useCountryHits(country.iso2, available.length > 0)
  const entry = year === null ? undefined : hits.data?.[String(year)]
  const [expanded, setExpanded] = useState(false)

  const todayButton = (
    <button
      type="button"
      onClick={onToday}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10 [&_svg]:size-3.5"
    >
      <History className="text-accent" /> {t.hits.today}
    </button>
  )

  if (index.isError || hits.isError) {
    return (
      <StateMessage
        icon={<CloudOff />}
        title={t.hits.failed}
        action={
          <button
            type="button"
            onClick={() => void (index.isError ? index.refetch() : hits.refetch())}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-hi ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <RotateCw className="size-3.5" /> {t.common.tryAgain}
          </button>
        }
      >
        {t.hits.failedText}
      </StateMessage>
    )
  }

  if (index.isPending) return <HitsSkeleton label={t.hits.loading} />

  if (available.length === 0) {
    // The nearest decade that has a chart, if any.
    const nearest = hitDecades(years).sort((a, b) => Math.abs(a - decade) - Math.abs(b - decade))[0]
    return (
      <StateMessage
        icon={<CalendarX2 />}
        title={t.hits.none(name, decade)}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {nearest !== undefined && (
              <button
                type="button"
                onClick={() => onDecade(nearest)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-on-accent transition active:scale-95 [&_svg]:size-3.5"
              >
                {t.hits.jump(t.decade.label(nearest))} <ArrowRight />
              </button>
            )}
            {country.artistCount > 0 && (
              <button
                type="button"
                onClick={onShowArtists}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10 [&_svg]:size-3.5"
              >
                <Music2 className="text-accent" /> {t.hits.showArtists}
              </button>
            )}
            {todayButton}
          </div>
        }
      >
        {t.hits.noneText}
      </StateMessage>
    )
  }

  const songs = entry?.songs ?? []
  const focusIndex = focus && year === focus.year ? songs.findIndex(([title, artist]) => anySongKey(title, artist) === focus.key) : -1
  // A picked-out song further down opens the whole list.
  const shown = expanded || focusIndex >= FIRST_PAGE ? songs : songs.slice(0, FIRST_PAGE)

  return (
    <section aria-labelledby="hits-heading">
      <div className="flex items-start justify-between gap-3">
        <h3 id="hits-heading" className="min-w-0 font-display text-[26px] leading-8">
          {year !== null && (entry?.kind === 'festival' ? t.hits.festival(year) : t.hits.title(name, year))}
        </h3>
      </div>

      <div role="group" aria-label={t.hits.years} className="mt-3 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => decade + i).map((option) => {
          const has = available.includes(option)
          return (
            <button
              key={option}
              type="button"
              disabled={!has}
              aria-pressed={option === year}
              onClick={() => {
                setPicked(option)
                setExpanded(false)
              }}
              className={cn(
                'rounded-lg py-1.5 font-mono text-[12.5px] ring-1 transition',
                option === year
                  ? 'bg-accent text-on-accent ring-transparent'
                  : has
                    ? 'bg-white/[0.05] text-hi ring-white/10 hover:bg-white/10'
                    : 'cursor-not-allowed text-lo/50 ring-white/[0.04]',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>

      {entry?.kind === 'festival' && <p className="mt-3 text-[12.5px] leading-5 text-mid">{t.hits.festivalNote}</p>}
      {city && (
        <p className="mt-3 flex gap-2 rounded-xl bg-white/[0.035] px-3 py-2.5 text-[12.5px] leading-5 text-mid ring-1 ring-white/[0.06]">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>{t.hits.cityNote(name)}</span>
        </p>
      )}

      {hits.isPending || !entry ? (
        <HitsSkeleton label={t.hits.loading} />
      ) : (
        <>
          <ol className="-mx-2 mt-3" aria-labelledby="hits-heading">
            {shown.map((song, rank) => (
              <HitRow key={`${song[0]}|${song[1]}`} song={song} rank={rank + 1} focused={rank === focusIndex} />
            ))}
          </ol>
          {songs.length > FIRST_PAGE && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 w-full rounded-xl py-2 text-[13px] font-medium text-accent transition hover:bg-white/[0.04]"
            >
              {expanded ? t.common.showFewer : t.common.showAll(songs.length)}
            </button>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <a href={wikipediaUrl(entry.page)} target="_blank" rel="noopener noreferrer" className="min-w-0 text-[11.5px] text-lo hover:text-mid hover:underline">
              {t.hits.source(entry.page.slice(entry.page.indexOf(':') + 1))}
            </a>
            {todayButton}
          </div>
        </>
      )}
    </section>
  )
}

function HitRow({ song: [title, artist, weeks, note], rank, focused = false }: { song: HitSong; rank: number; focused?: boolean }) {
  const { t } = useI18n()
  const meta = note ? t.hits.prize(note) : weeks > 0 ? t.hits.weeks(weeks) : null
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' })
  }, [focused])
  return (
    <li
      ref={ref}
      aria-current={focused || undefined}
      className={cn(
        'grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]',
        focused && 'bg-accent-soft ring-1 ring-accent',
      )}
    >
      <span className="text-right font-mono text-[11px] text-lo">{rank}</span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-5 text-hi">{title}</p>
        <p className="truncate text-[12.5px] leading-5 text-mid">
          {artist}
          {meta && (
            <span className={cn('ml-1.5 text-[11.5px]', note ? 'text-accent' : 'text-lo')}>
              {note ? <Trophy aria-hidden className="mr-0.5 inline size-3 -translate-y-px" /> : '· '}
              {meta}
            </span>
          )}
        </p>
      </div>
      <PlayButton request={{ key: `hit:${artist}|${title}`, label: t.player.trackBy(title, artist), params: { artist, title } }} />
    </li>
  )
}

function HitsSkeleton({ label }: { label: string }) {
  return (
    <ul className="mt-3" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-2 py-2.5">
          <div className="skeleton h-2.5 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-3/4 rounded-full" />
            <div className="skeleton h-2.5 w-1/2 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}
