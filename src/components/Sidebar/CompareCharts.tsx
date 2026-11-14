import { ArrowLeftRight, Earth, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { countriesByIso2 } from '../../data'
import { useChart, type ChartTarget } from '../../hooks/useChart'
import { useSearchCities } from '../../hooks/usePlaces'
import { useSpotlight } from '../../hooks/useSpotlight'
import { useI18n } from '../../i18n/context'
import type { ChartTrack } from '../../types/charts'
import { fold } from '../../utils/settlements'
import { nationalPlaces, placeName, type ChartPlace } from '../../utils/chartPlaces'
import { songKey } from '../../utils/songKey'
import { CoverImage } from '../UI/CoverImage'
import { Flag } from '../UI/Flag'
import { PlayButton } from '../UI/PlayButton'

/** Every place with a chart: countries first, then Shazam's 175 city charts once the city list loads. */
function useChartPlaces(): ChartPlace[] {
  const { data: cities } = useSearchCities(true)
  return useMemo(() => {
    const cityPlaces = (cities ?? []).flatMap((city) => {
      const country = countriesByIso2.get(city.iso2.toLowerCase())
      if (!city.chart || !country?.shazam) return []
      return [
        {
          key: `city:${city.iso2}:${city.chart}`,
          kind: 'city' as const,
          name: city.name,
          country,
          iso2: city.iso2,
          target: { scope: 'city' as const, params: { source: 'shazam', country: country.shazam, city: city.chart } },
        },
      ]
    })
    return [...nationalPlaces, ...cityPlaces]
  }, [cities])
}

/** Searchable list of places to compare the current chart with. */
export function ComparePicker({ current, onPick, onCancel }: { current: string; onPick: (place: ChartPlace) => void; onCancel: () => void }) {
  const places = useChartPlaces()
  const { t, countryName } = useI18n()
  const [query, setQuery] = useState('')
  const q = fold(query.trim())
  // Countries match by their English and their translated name ("Japán" and "Japan").
  const shown = places
    .filter((place) => place.key !== current && (!q || fold(place.name).includes(q) || fold(placeName(place, countryName)).includes(q)))
    .slice(0, 40)

  return (
    <div className="mt-4 rounded-2xl bg-white/[0.035] p-2 ring-1 ring-white/[0.07]">
      <div className="flex items-center gap-2 px-2">
        <Search aria-hidden className="size-4 shrink-0 text-lo" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.compare.placeholder}
          aria-label={t.compare.placeLabel}
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-hi outline-none placeholder:text-lo"
        />
        <button
          type="button"
          onClick={onCancel}
          aria-label={t.compare.cancel}
          className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
        >
          <X />
        </button>
      </div>
      <ul className="scroll-thin max-h-72 overflow-y-auto" aria-label={t.compare.places}>
        {shown.map((place) => (
          <li key={place.key}>
            <button
              type="button"
              onClick={() => onPick(place)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.06]"
            >
              <Flag iso2={place.iso2} className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-white/15" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-hi">{placeName(place, countryName)}</span>
              <span className="shrink-0 text-[11.5px] text-lo">{place.kind === 'country' ? t.compare.national : t.compare.cityChart(countryName(place.country))}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-mid">{t.compare.noPlace}</li>}
      </ul>
    </div>
  )
}

/** Up to 50 songs, so a city's Shazam top 50 isn't cut to 25 when compared. */
const full = (target: ChartTarget): ChartTarget => ({ ...target, params: { ...target.params, limit: '50' } })

type Side = { name: string; target: ChartTarget }

/** Two charts side by side, as one list: the songs both places play, then each one's own. */
export function CompareView({ a, b, onClose }: { a: Side; b: Side; onClose: () => void }) {
  const first = useChart(full(a.target))
  const second = useChart(full(b.target))
  const [expanded, setExpanded] = useState<'a' | 'b' | null>(null)
  const { t } = useI18n()

  const result = useMemo(() => {
    if (!first.data || !second.data) return null
    const inSecond = new Map(second.data.tracks.map((track) => [songKey(track.artist, track.title), track]))
    const inFirst = new Map(first.data.tracks.map((track) => [songKey(track.artist, track.title), track]))
    const shared = first.data.tracks.flatMap((track) => {
      const other = inSecond.get(songKey(track.artist, track.title))
      return other ? [{ track, rankA: track.rank, rankB: other.rank }] : []
    })
    shared.sort((x, y) => x.rankA + x.rankB - (y.rankA + y.rankB))
    const onlyA = first.data.tracks.filter((track) => !inSecond.has(songKey(track.artist, track.title)))
    const onlyB = second.data.tracks.filter((track) => !inFirst.has(songKey(track.artist, track.title)))
    const smaller = Math.min(first.data.tracks.length, second.data.tracks.length)
    return { shared, onlyA, onlyB, share: smaller ? shared.length / smaller : 0 }
  }, [first.data, second.data])

  const failed = first.isError || second.isError

  return (
    <section aria-label={t.compare.region(a.name, b.name)} className="mt-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-display text-[22px] leading-7">
          {a.name} <ArrowLeftRight aria-hidden className="inline size-4 text-accent" /> {b.name}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-3 py-1 text-[12.5px] text-mid ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-hi"
        >
          {t.common.done}
        </button>
      </div>

      {failed ? (
        <p className="mt-3 text-[13px] text-mid">{t.compare.failed}</p>
      ) : !result ? (
        <ul className="mt-3 space-y-2" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="skeleton h-12 rounded-xl" />
          ))}
        </ul>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] leading-5 text-mid">
            {t.compare.summary(result.shared.length, Math.round(result.share * 100))}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(result.share * 100)}%` }} />
          </div>

          <h4 className="label-mono mb-1 mt-5">{t.compare.inBoth}</h4>
          {result.shared.length === 0 ? (
            <p className="text-[13px] text-mid">{t.compare.nothingShared}</p>
          ) : (
            <ol className="-mx-2">
              {result.shared.map(({ track, rankA, rankB }) => (
                <CompareRow key={songKey(track.artist, track.title)} track={track} ranks={[`#${rankA} ${a.name}`, `#${rankB} ${b.name}`]} />
              ))}
            </ol>
          )}

          {(
            [
              ['a', a.name, result.onlyA],
              ['b', b.name, result.onlyB],
            ] as const
          ).map(([side, name, tracks]) => (
            <div key={side}>
              <h4 className="label-mono mb-1 mt-5">{t.compare.onlyIn(name, tracks.length)}</h4>
              <ol className="-mx-2">
                {(expanded === side ? tracks : tracks.slice(0, 8)).map((track) => (
                  <CompareRow key={songKey(track.artist, track.title)} track={track} ranks={[`#${track.rank}`]} />
                ))}
              </ol>
              {tracks.length > 8 && (
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === side ? null : side)}
                  className="mt-1 w-full rounded-xl py-1.5 text-[12.5px] font-medium text-accent transition hover:bg-white/[0.04]"
                >
                  {expanded === side ? t.common.showFewer : t.common.showAll(tracks.length)}
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function CompareRow({ track, ranks }: { track: ChartTrack; ranks: string[] }) {
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]">
      <CoverImage src={track.artwork} className="relative size-10 rounded-md ring-1 ring-white/10" />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium leading-5 text-hi">{track.title}</p>
        <p className="truncate text-[12px] leading-5 text-mid">{track.artist}</p>
        <p className="flex flex-wrap gap-1">
          {ranks.map((rank) => (
            <span key={rank} className="rounded-full bg-white/[0.06] px-1.5 font-mono text-[10.5px] text-mid">
              {rank}
            </span>
          ))}
        </p>
      </div>
      <TrackActions track={track} />
    </li>
  )
}

/** Play the preview, or see where else the song is charting. */
export function TrackActions({ track }: { track: ChartTrack }) {
  const spotlight = useSpotlight()
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => spotlight({ title: track.title, artist: track.artist, artwork: track.artwork })}
        aria-label={t.chart.whereElse(track.title)}
        title={t.chart.whereElseTitle}
        className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-accent [&_svg]:size-4"
      >
        <Earth />
      </button>
      {track.deezerId && (
        <PlayButton request={{ key: `track:${track.deezerId}`, label: t.player.trackBy(track.title, track.artist), params: { track: String(track.deezerId) } }} />
      )}
    </div>
  )
}
