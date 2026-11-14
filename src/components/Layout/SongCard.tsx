import { ArrowLeft, Disc3, Earth, Mic2, Music2, Trophy, X } from 'lucide-react'
import { motion } from 'motion/react'
import { countriesByIso2 } from '../../data'
import { useArtistOrigin } from '../../hooks/useArtists'
import { useSongDetails, useSongIndex } from '../../hooks/useHits'
import { useI18n } from '../../i18n/context'
import type { SongEntry } from '../../types/hits'
import { anySongKey, leadArtist, type SongHit } from '../../utils/hitSearch'
import { CoverImage } from '../UI/CoverImage'
import { Flag } from '../UI/Flag'
import { PlayButton } from '../UI/PlayButton'
import type { ArtistRef } from './ArtistCard'

/** A song: from the number-one lists (`hit`), or any song in Deezer's catalogue (`track`). */
export type SongRef = { title: string; artist: string; track?: number; artistId?: number; album?: string; cover?: string; hit?: SongHit }

type SongCardProps = {
  song: SongRef
  /** The artist's card it was picked from, for the way back. */
  from?: ArtistRef
  /** Opens that country's number ones of that year, with the song picked out. */
  onOpen: (song: SongHit, entry: SongEntry) => void
  onArtist: (artist: ArtistRef) => void
  onShowOnGlobe: () => void
  onClose: () => void
}

/** A song: its artist and where they come from, its release, and where and when it was number one. */
export function SongCard({ song, from, onOpen, onArtist, onShowOnGlobe, onClose }: SongCardProps) {
  const { t, countryName } = useI18n()
  const index = useSongIndex(true)
  // A song found on Deezer may still have topped a chart somewhere.
  const hit = song.hit ?? index.data?.byKey.get(anySongKey(song.title, song.artist))
  const details = useSongDetails({ title: song.title, artist: song.artist, track: song.track })
  const lead = leadArtist(song.artist)
  const origin = useArtistOrigin(lead)
  const originCountry = origin ? countriesByIso2.get(origin.iso2.toLowerCase()) : undefined
  // Deezer often has a later reissue: for a number one, a date after its first year can't be its release.
  const released = details.data?.released
  const releaseDate = released && (!hit || Number(released.slice(0, 4)) <= hit.first) ? new Intl.DateTimeFormat(t.locale, { dateStyle: 'long' }).format(new Date(released)) : null
  const album = song.album ?? details.data?.album
  const firstEntries = hit ? hit.entries.filter(([, year]) => year === hit.first) : []
  const firstCountry = firstEntries.length === 1 ? countriesByIso2.get(firstEntries[0][0].toLowerCase()) : undefined

  return (
    <motion.section
      aria-label={t.history.region(song.title)}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className="glass scroll-thin pointer-events-auto max-h-[min(72vh,680px)] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-2xl p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {from && (
            <button
              type="button"
              onClick={() => onArtist(from)}
              className="mb-1 inline-flex max-w-full items-center gap-1 text-[11.5px] text-lo transition hover:text-accent [&_svg]:size-3"
            >
              <ArrowLeft className="shrink-0" />
              <span className="truncate">{t.history.back(from.name)}</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <CoverImage src={details.data?.cover ?? song.cover} className="relative size-12 shrink-0 rounded-lg ring-1 ring-white/10" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-lo">
                {hit ? <Trophy aria-hidden className="size-3.5 text-accent" /> : <Music2 aria-hidden className="size-3.5 text-accent" />}
                {hit ? t.history.song : t.history.plainSong}
              </p>
              <p className="truncate text-[15px] font-medium text-hi">{song.title}</p>
            </div>
            <PlayButton
              request={
                song.track
                  ? { key: `track:${song.track}`, label: t.player.trackBy(song.title, song.artist), params: { track: String(song.track) } }
                  : { key: `hit:${song.artist}|${song.title}`, label: t.player.trackBy(song.title, song.artist), params: { artist: song.artist, title: song.title } }
              }
            />
          </div>
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

      {/* Who sang it, and where they come from: one click to their card. */}
      <button
        type="button"
        onClick={() => onArtist({ name: origin?.name ?? lead, origin, deezer: song.artistId ?? origin?.deezer })}
        aria-label={t.history.openArtist(origin?.name ?? lead)}
        className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-accent"
      >
        <Mic2 aria-hidden className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] text-hi">{song.artist}</span>
          {origin && (
            <span className="flex items-center gap-1.5 truncate text-[12px] text-mid">
              {originCountry && <Flag iso2={originCountry.iso2} className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-white/15" />}
              {[origin.city, originCountry && countryName(originCountry)].filter(Boolean).join(', ')}
              {origin.year ? ` · ${origin.kind === 'g' ? t.artistCard.formed(origin.year) : t.artistCard.born(origin.year)}` : ''}
            </span>
          )}
        </span>
      </button>

      <p className="mt-2 space-y-0.5 text-[12.5px] leading-5 text-mid">
        {album && (
          <span className="flex items-center gap-1.5">
            <Disc3 aria-hidden className="size-3.5 shrink-0 text-lo" /> {t.history.album(album)}
          </span>
        )}
        {releaseDate && <span className="block">{t.history.released(releaseDate)}</span>}
        {hit && <span className="block">{firstCountry ? t.history.first(hit.first, countryName(firstCountry)) : t.history.firstYear(hit.first)}</span>}
      </p>

      {hit ? (
        <>
          <p className="mt-2 text-[12px] text-mid">{t.history.countries(hit.countries)}</p>
          <ul className="scroll-thin mt-1.5 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {hit.entries.map((entry) => {
              const [iso2, year, weeks] = entry
              const country = countriesByIso2.get(iso2.toLowerCase())
              if (!country) return null
              return (
                <li key={`${iso2}-${year}`}>
                  <button
                    type="button"
                    onClick={() => onOpen(hit, entry)}
                    aria-label={t.history.open(countryName(country), year)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-1.5 pr-2 text-[12px] text-hi ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-accent"
                  >
                    <Flag iso2={country.iso2} className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-white/15" />
                    {countryName(country)}
                    <span className="font-mono text-[11px] text-accent">{year}</span>
                    <span className="text-[10.5px] text-lo">{weeks > 0 ? t.history.weeks(weeks) : t.history.festival}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[11px] text-lo">{t.history.hint}</p>
        </>
      ) : (
        index.data && <p className="mt-2 text-[11.5px] text-lo">{t.history.notNumberOne}</p>
      )}
    </motion.section>
  )
}
