import { CloudOff, Crown, Mic2, RotateCw, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { countriesByIso2 } from '../../data'
import { useAllTime } from '../../hooks/useHits'
import { useI18n } from '../../i18n/context'
import type { AllTimeSong } from '../../types/hits'
import type { Country } from '../../types/music'
import { leadArtist } from '../../utils/hitSearch'
import { cn } from '../../utils/misc'
import type { ArtistRef } from '../Layout/ArtistCard'
import type { SongRef } from '../Layout/SongCard'
import { Flag } from '../UI/Flag'
import { IconButton } from '../UI/IconButton'
import { PlayButton } from '../UI/PlayButton'
import { StateMessage } from '../UI/StateMessage'
import { ChartModeSwitch, type ChartMode } from './ChartModeSwitch'

type AllTimeContentProps = {
  onClose: () => void
  onMode: (mode: ChartMode) => void
  onOpenCountry: (country: Country) => void
  onSong: (song: SongRef) => void
  onArtist: (artist: ArtistRef) => void
  scrollLocked?: boolean
}

const songRef = (song: AllTimeSong): SongRef => ({ title: song.title, artist: song.artist, hit: song })
const artistRef = (song: AllTimeSong): ArtistRef => ({ name: song.origin?.name ?? leadArtist(song.artist), origin: song.origin })

/** The all-time Top 30 from 40 countries' number ones: each song and artist opens its card. */
export function AllTimeContent({ onClose, onMode, onOpenCountry, onSong, onArtist, scrollLocked = false }: AllTimeContentProps) {
  const query = useAllTime(true)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { t, countryName } = useI18n()
  const songs = useMemo(() => query.data ?? [], [query.data])
  // Where the artists come from, most first.
  const origins = useMemo(() => {
    const counts = new Map<string, number>()
    for (const song of songs) if (song.origin) counts.set(song.origin.iso2, (counts.get(song.origin.iso2) ?? 0) + 1)
    return [...counts].flatMap(([iso2, count]) => {
      const country = countriesByIso2.get(iso2.toLowerCase())
      return country ? [{ country, count }] : []
    }).sort((a, b) => b.count - a.count)
  }, [songs])

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

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
              <Crown />
            </span>
            <IconButton label={t.common.close} variant="ghost" onClick={onClose} className="-mr-2 -mt-2">
              <X />
            </IconButton>
          </div>
          <div className="relative mt-4">
            <ChartModeSwitch mode="alltime" onMode={onMode} />
          </div>
          <p className="label-mono relative mt-4">{t.allTime.label}</p>
          <h2
            id="global-heading"
            ref={headingRef}
            tabIndex={-1}
            className="relative mt-1 font-display text-[44px] leading-[48px] tracking-[-0.01em] outline-none"
          >
            {t.allTime.heading}
          </h2>
          <p className={cn('relative mt-2 text-[14.5px] leading-6 text-mid', scrollLocked && 'line-clamp-2')}>{t.allTime.intro}</p>
        </header>

        {origins.length > 0 && (
          <section aria-labelledby="alltime-origins" className="px-6">
            <h3 id="alltime-origins" className="label-mono mb-2">
              {t.allTime.origins}
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

        <section aria-label={t.allTime.heading} className="mt-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {query.isPending ? (
            <ol aria-hidden>
              {Array.from({ length: 8 }, (_, index) => (
                <li key={index} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="skeleton h-2.5 w-4 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded-full" />
                    <div className="skeleton h-2.5 w-1/2 rounded-full" />
                  </div>
                </li>
              ))}
            </ol>
          ) : query.isError ? (
            <StateMessage
              icon={<CloudOff />}
              title={t.allTime.failed}
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
            <ol className="-mx-2" aria-label={t.allTime.heading}>
              {songs.map((song, index) => (
                <AllTimeRow key={`${song.title}|${song.artist}`} song={song} rank={index + 1} onSong={onSong} onArtist={onArtist} />
              ))}
            </ol>
          )}
          <p className="mt-6 border-t border-white/[0.06] pt-4 text-[12px] text-lo">{t.allTime.credits}</p>
        </section>
      </div>
    </motion.div>
  )
}

function AllTimeRow({ song, rank, onSong, onArtist }: { song: AllTimeSong; rank: number; onSong: (song: SongRef) => void; onArtist: (artist: ArtistRef) => void }) {
  const { t, countryName } = useI18n()
  const country = song.origin ? countriesByIso2.get(song.origin.iso2.toLowerCase()) : undefined
  return (
    <li className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]">
      <span className="text-right font-mono text-[11px] text-lo">{rank}</span>
      <div className="min-w-0">
        <button type="button" onClick={() => onSong(songRef(song))} className="block max-w-full truncate text-left text-[14px] font-medium leading-5 text-hi hover:text-accent hover:underline">
          {song.title}
        </button>
        <button
          type="button"
          onClick={() => onArtist(artistRef(song))}
          aria-label={t.history.openArtist(song.artist)}
          className="flex max-w-full items-center gap-1.5 text-left text-[12.5px] leading-5 text-mid hover:text-accent"
        >
          <Mic2 aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{song.artist}</span>
          {country && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-lo">
              · <Flag iso2={country.iso2} className="h-2.5 w-[15px] rounded-[2px] ring-1 ring-white/15" />
              {song.origin?.city ? `${song.origin.city}, ${countryName(country)}` : countryName(country)}
            </span>
          )}
        </button>
        <p className="text-[11.5px] text-lo">
          <span className="font-mono text-accent">{song.first}</span> · {t.allTime.share(song.countries, song.coverage)}
        </p>
      </div>
      <PlayButton request={{ key: `hit:${song.artist}|${song.title}`, label: t.player.trackBy(song.title, song.artist), params: { artist: song.artist, title: song.title } }} />
    </li>
  )
}
