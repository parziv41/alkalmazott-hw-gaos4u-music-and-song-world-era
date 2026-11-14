import { CloudOff, Disc3, Earth, History, LoaderCircle, MapPin, Mic2, Trophy, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { countriesByIso2 } from '../../data'
import { useArtistOrigin, useDiscography } from '../../hooks/useArtists'
import { useSongIndex } from '../../hooks/useHits'
import { useI18n } from '../../i18n/context'
import type { ArtistMatch } from '../../types/artists'
import { nameKey, type ArtistHit, type SongHit } from '../../utils/hitSearch'
import { cn } from '../../utils/misc'
import { CoverImage } from '../UI/CoverImage'
import { Flag } from '../UI/Flag'
import { PlayButton } from '../UI/PlayButton'

/**
 * A searched artist: where they come from (the artist index), their number ones if they had any, and
 * their Deezer id when found on Deezer only.
 */
export type ArtistRef = { name: string; origin?: ArtistMatch; hits?: ArtistHit; deezer?: number }

type ArtistCardProps = {
  artist: ArtistRef
  /** Fly to their birthplace or place of formation and open it. */
  onOpenOrigin: (origin: ArtistMatch) => void
  /** The time machine at that decade (and their home country's number ones then). */
  onDecade: (decade: number) => void
  onSong: (song: SongHit) => void
  onShowOnGlobe: () => void
  onClose: () => void
}

const FIRST_RELEASES = 8

/** Who an artist is, where they come from, their era (releases by decade), best-known songs and number ones. */
export function ArtistCard({ artist, onOpenOrigin, onDecade, onSong, onShowOnGlobe, onClose }: ArtistCardProps) {
  const { t, countryName, number } = useI18n()
  // Found on Deezer only? The artist index may still know where they come from.
  const lookedUp = useArtistOrigin(artist.origin ? null : artist.name)
  const origin = artist.origin ?? lookedUp
  const songIndex = useSongIndex(true)
  const hits = artist.hits ?? songIndex.data?.byName.get(nameKey(artist.name)) ?? (origin?.alias ? songIndex.data?.byName.get(nameKey(origin.alias)) : undefined)
  const discography = useDiscography({ name: artist.name, deezer: artist.deezer ?? origin?.deezer })
  const country = origin ? countriesByIso2.get(origin.iso2.toLowerCase()) : undefined
  const [allReleases, setAllReleases] = useState(false)

  const releases = discography.data?.releases ?? []
  const years = releases.map((release) => Number(release.date.slice(0, 4))).filter((year) => year >= 1850)
  const hitYears = (hits?.songs ?? []).flatMap((song) => song.entries.map(([, year]) => year))
  // The career, from everything known: when a band formed, its number ones, and its releases on Deezer
  // (which often has only later reissues: the Beatles' start there in 1993). A person's birth year isn't
  // the start of a career, so it doesn't count.
  const career = [...years, ...hitYears, ...(origin?.kind === 'g' && origin.year ? [origin.year] : [])]
  const first = career.length ? Math.min(...career) : null
  const last = career.length ? Math.max(...career) : null
  // The era: how many releases each decade, and in which decades they had number ones.
  const decadeOf = (year: number) => Math.floor(year / 10) * 10
  const perDecade = new Map<number, number>()
  for (const year of years) perDecade.set(decadeOf(year), (perDecade.get(decadeOf(year)) ?? 0) + 1)
  const hitDecades = new Set(hitYears.map(decadeOf))
  const decades = [...new Set(career.map(decadeOf))].sort((a, b) => a - b)
  const most = Math.max(1, ...perDecade.values())

  const shownReleases = allReleases ? releases : releases.slice(0, FIRST_RELEASES)

  return (
    <motion.section
      aria-label={t.artistCard.region(artist.name)}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className="glass scroll-thin pointer-events-auto max-h-[min(72vh,680px)] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-2xl p-3.5"
    >
      <div className="flex items-start gap-3">
        <CoverImage src={discography.data?.picture} className="relative size-14 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-lo">
            <Mic2 aria-hidden className="size-3.5 text-accent" /> {t.artistCard.heading}
          </p>
          <h3 className="truncate font-display text-[26px] leading-8">{artist.name}</h3>
          {origin && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-mid">
              <span>{origin.year ? (origin.kind === 'g' ? t.artistCard.formed(origin.year) : t.artistCard.born(origin.year)) : origin.kind === 'g' ? t.artistCard.group : t.artistCard.person}</span>
              <span className="text-lo">·</span>
              {country && <Flag iso2={country.iso2} className="h-3 w-[18px] rounded-[2px] ring-1 ring-white/15" />}
              <span>{[origin.city, country && countryName(country)].filter(Boolean).join(', ')}</span>
            </p>
          )}
          {origin && origin.genres.length > 0 && <p className="mt-0.5 truncate text-[12px] text-lo">{origin.genres.join(' · ')}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
          >
            <X />
          </button>
          <button
            type="button"
            onClick={onShowOnGlobe}
            aria-label={t.history.showOnGlobe}
            title={t.history.showOnGlobe}
            className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-accent [&_svg]:size-4"
          >
            <Earth />
          </button>
        </div>
      </div>

      {origin && (
        <button
          type="button"
          onClick={() => onOpenOrigin(origin)}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10 [&_svg]:size-3.5"
        >
          <MapPin className="text-accent" /> {t.artistCard.showOrigin(origin.city || (country ? countryName(country) : origin.iso2))}
        </button>
      )}

      {/* The era: releases per decade (and number ones), each decade a way into the time machine. */}
      {decades.length > 0 && (
        <section className="mt-3.5">
          <h4 className="label-mono">{first !== null && last !== null ? t.artistCard.career(first, last) : t.artistCard.decades}</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {decades.map((decade) => {
              const count = perDecade.get(decade) ?? 0
              return (
                <button
                  key={decade}
                  type="button"
                  onClick={() => onDecade(decade)}
                  aria-label={t.artistCard.decadeButton(t.decade.label(decade), count)}
                  className="group flex min-w-[64px] flex-col items-stretch gap-1 rounded-lg bg-white/[0.04] px-2 py-1.5 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-accent"
                >
                  <span className="flex items-center justify-between gap-1.5 font-mono text-[11.5px] text-hi">
                    {t.decade.label(decade)}
                    {hitDecades.has(decade) && <Trophy aria-hidden className="size-3 text-accent" />}
                  </span>
                  <span aria-hidden className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((count / most) * 100)}%` }} />
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-lo">
            <History aria-hidden className="size-3" /> {t.artistCard.decadeHint}
          </p>
        </section>
      )}

      {discography.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-mid">
          <LoaderCircle className="size-3.5 animate-spin" /> {t.artistCard.loading}
        </p>
      ) : discography.isError ? (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-mid">
          <CloudOff className="size-3.5" /> {t.artistCard.failed}
        </p>
      ) : !discography.data ? (
        <p className="mt-3 text-[12.5px] text-mid">{t.artistCard.noDeezer}</p>
      ) : (
        <>
          {discography.data.top.length > 0 && (
            <section className="mt-3.5">
              <h4 className="label-mono">{t.artistCard.topSongs}</h4>
              <ol className="-mx-1.5 mt-1">
                {discography.data.top.map((track) => (
                  <li key={track.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/[0.035]">
                    <CoverImage src={track.cover} className="relative size-9 rounded-md ring-1 ring-white/10" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-hi">{track.title}</span>
                      {track.album && <span className="block truncate text-[11.5px] text-lo">{track.album}</span>}
                    </span>
                    <PlayButton request={{ key: `track:${track.id}`, label: t.player.trackBy(track.title, discography.data!.name), params: { track: String(track.id) } }} />
                  </li>
                ))}
              </ol>
            </section>
          )}
          {releases.length > 0 && (
            <section className="mt-3.5">
              <h4 className="label-mono">
                {t.artistCard.releases} · {number(releases.length)}
              </h4>
              <ol className="mt-1">
                {shownReleases.map((release) => (
                  <li key={`${release.date}-${release.title}`} className="flex items-center gap-3 py-1 text-[12.5px]">
                    <span className="w-10 shrink-0 font-mono text-[11.5px] text-accent">{release.date.slice(0, 4)}</span>
                    <Disc3 aria-hidden className="size-3.5 shrink-0 text-lo" />
                    <span className="min-w-0 flex-1 truncate text-hi">{release.title}</span>
                    <span className="shrink-0 text-[11px] text-lo">{t.artistCard.type(release.type)}</span>
                  </li>
                ))}
              </ol>
              {releases.length > FIRST_RELEASES && (
                <button type="button" onClick={() => setAllReleases(!allReleases)} className="mt-1 text-[12px] font-medium text-accent hover:underline">
                  {allReleases ? t.common.showFewer : t.common.showAll(releases.length)}
                </button>
              )}
            </section>
          )}
        </>
      )}

      {hits && hits.songs.length > 0 && (
        <section className="mt-3.5">
          <h4 className="label-mono">{t.artistCard.numberOnes}</h4>
          <p className="mt-0.5 text-[12px] text-mid">{t.history.artistSummary(hits.songs.length, hits.countries, hits.first, hits.last)}</p>
          <ol className="mt-1">
            {hits.songs.map((song) => (
              <li key={`${song.title}|${song.artist}`}>
                <button
                  type="button"
                  onClick={() => onSong(song)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/[0.05]')}
                >
                  <span className="w-10 shrink-0 font-mono text-[11.5px] text-accent">{song.first}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-hi">{song.title}</span>
                  <span className="flex shrink-0 -space-x-1">
                    {[...new Set(song.entries.map(([iso2]) => iso2))].slice(0, 6).map((iso2) => (
                      <Flag key={iso2} iso2={iso2} className="h-3 w-[18px] rounded-[2px] ring-1 ring-ink-900" />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </motion.section>
  )
}
