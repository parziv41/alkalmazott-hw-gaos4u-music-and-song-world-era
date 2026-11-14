import { BookOpen, Clapperboard, History, MapPin, Music2, Users, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { inDecade } from '../../hooks/useTimeline'
import { useI18n } from '../../i18n/context'
import type { Country } from '../../types/music'
import type { Artist, City, CountryPlaces, Film } from '../../types/places'
import { cn } from '../../utils/misc'
import { PlayButton } from '../UI/PlayButton'
import { StateMessage } from '../UI/StateMessage'

const PAGE = 30
const TOP_CITIES = 8

type PlaceTabProps = {
  country: Country
  city: City | null
  places?: CountryPlaces
  loading: boolean
  onSelectCity: (city: City | null) => void
  /** Time machine: only what was born, formed or made in this decade. */
  decade: number | null
  onClearDecade: () => void
}

/** "1960s ×": the time machine's decade, which narrows the list; the × turns the filter off. */
function DecadeChip({ decade, onClear }: { decade: number | null; onClear: () => void }) {
  const { t } = useI18n()
  if (decade === null) return null
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={t.places.allDecades(t.decade.label(decade))}
      className="ml-2 inline-flex translate-y-[-3px] items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2 pr-1.5 align-middle font-sans text-[12px] text-accent ring-1 ring-white/10 transition hover:bg-accent hover:text-on-accent"
    >
      <History className="size-3" />
      {t.decade.label(decade)}
      <X className="size-3" />
    </button>
  )
}

type Placed<T> = { item: T; city: City }

/** Items of one kind for the whole country (each once, most famous first) or for one city. */
function useItems<T extends { id: string; sl: number }>(places: CountryPlaces | undefined, city: City | null, pick: (c: City) => T[]) {
  return useMemo(() => {
    const cities = city ? [city] : (places?.cities ?? [])
    const seen = new Set<string>()
    const items: Placed<T>[] = []
    for (const c of cities) {
      for (const item of pick(c)) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        items.push({ item, city: c })
      }
    }
    items.sort((a, b) => b.item.sl - a.item.sl)
    const topCities = city
      ? []
      : (places?.cities ?? [])
          .map((c) => ({ city: c, count: pick(c).length }))
          .filter(({ count }) => count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_CITIES)
    return { items, topCities }
  }, [places, city, pick])
}

const wikipedia = (id: string) => `https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${id}`
const commonsThumb = (file: string, width: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`

function CityChips({ cities, onSelect }: { cities: { city: City; count: number }[]; onSelect: (city: City) => void }) {
  const { t } = useI18n()
  if (cities.length < 2) return null
  return (
    <div className="mt-3">
      <p className="label-mono mb-2">{t.places.topCities}</p>
      <div className="flex flex-wrap gap-1.5">
        {cities.map(({ city, count }) => (
          <button
            key={city.id}
            type="button"
            onClick={() => onSelect(city)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-3 pr-2 text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-white/10"
          >
            {city.name}
            <span className="rounded-full bg-white/[0.07] px-1.5 font-mono text-[10.5px] text-mid">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Paged<T>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const [count, setCount] = useState(PAGE)
  const { t } = useI18n()
  return (
    <>
      <ol className="-mx-2 mt-4">{items.slice(0, count).map(render)}</ol>
      {items.length > count && (
        <button
          type="button"
          onClick={() => setCount((value) => value + PAGE)}
          className="mt-2 w-full rounded-xl py-2 text-[13px] font-medium text-accent transition hover:bg-white/[0.04]"
        >
          {t.common.showMore(Math.min(PAGE, items.length - count), items.length - count)}
        </button>
      )}
    </>
  )
}

function ListSkeleton() {
  return (
    <ol className="mt-4" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="grid grid-cols-[44px_1fr] items-center gap-3 py-1.5">
          <div className="skeleton size-11 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-3 w-2/3 rounded-full" />
            <div className="skeleton h-2.5 w-2/5 rounded-full" />
          </div>
        </li>
      ))}
    </ol>
  )
}

function CityLink({ city, onSelect }: { city: City; onSelect: (city: City) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(city)}
      className="inline-flex max-w-full items-center gap-1 truncate text-[11.5px] text-lo transition hover:text-accent"
    >
      <MapPin className="size-3 shrink-0" />
      <span className="truncate">{city.name}</span>
    </button>
  )
}

// ── Artists ──────────────────────────────────────────────────────────────────

const pickArtists = (c: City) => c.artists

/** Musicians born, and bands formed, in a country or city. */
export function ArtistsTab({ country, city, places, loading, onSelectCity, decade, onClearDecade }: PlaceTabProps) {
  const pick = useCallback((c: City) => (decade === null ? pickArtists(c) : c.artists.filter((artist) => inDecade(artist.year, decade))), [decade])
  const { items, topCities } = useItems<Artist>(places, city, pick)
  const { t, countryName } = useI18n()
  const where = city?.name ?? countryName(country)
  const when = decade === null ? null : t.decade.inThe(decade)

  return (
    <section aria-labelledby="artists-heading">
      <h3 id="artists-heading" className="font-display text-[26px] leading-8">
        {t.places.madeIn(where)}
        <DecadeChip decade={decade} onClear={onClearDecade} />
      </h3>
      <p className="mt-0.5 text-[12.5px] leading-5 text-lo">
        {items.length > 0
          ? t.places.artistsSummary(items.length, when)
          : loading
            ? t.places.findingArtists
            : ''}
      </p>
      <CityChips cities={topCities} onSelect={onSelectCity} />
      {loading && !places ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="mt-4">
          <StateMessage icon={<Music2 />} title={t.places.noArtists}>
            {when === null ? t.places.noArtistsText(where) : t.places.noArtistsDecade(where, when)}
          </StateMessage>
        </div>
      ) : (
        <Paged
          key={city?.id ?? 'all'}
          items={items}
          render={({ item, city: home }) => <ArtistRow key={item.id} artist={item} city={city ? null : home} onSelectCity={onSelectCity} />}
        />
      )}
    </section>
  )
}

function ArtistRow({ artist, city, onSelectCity }: { artist: Artist; city: City | null; onSelectCity: (city: City) => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  const { t } = useI18n()
  const meta = [
    artist.kind === 'g' ? t.places.group : null,
    artist.genres?.filter((genre) => !/porn/i.test(genre)).join(', '),
    artist.year ? (artist.kind === 'g' ? t.places.formed(artist.year) : t.places.born(artist.year)) : null,
  ].filter(Boolean)
  const initials = artist.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')

  return (
    <li className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]">
      <div className="relative size-11 overflow-hidden rounded-full bg-[linear-gradient(135deg,color-mix(in_oklch,var(--accent)_40%,#141b30),#0d1222)] ring-1 ring-white/10">
        {artist.image && !imageFailed ? (
          <img
            src={commonsThumb(artist.image, 96)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center font-display text-[17px] text-hi/80">
            {artist.kind === 'g' ? <Users className="size-4" /> : initials}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-5 text-hi">{artist.name}</p>
        {meta.length > 0 && <p className="truncate text-[12px] leading-5 text-mid">{meta.join(' · ')}</p>}
        {city && <CityLink city={city} onSelect={onSelectCity} />}
      </div>
      <div className="flex items-center gap-1">
        <PlayButton
          request={{
            key: `artist:${artist.id}`,
            label: artist.name,
            params: artist.deezer ? { deezerArtist: String(artist.deezer), artist: artist.name } : { artist: artist.name },
          }}
        />
        <a
          href={wikipedia(artist.id)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.common.onWikipedia(artist.name)}
          title={t.common.wikipedia}
          className="grid size-8 place-items-center rounded-full text-lo transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 hover:bg-white/10 hover:text-hi focus-visible:opacity-100 [&_svg]:size-4"
        >
          <BookOpen />
        </a>
      </div>
    </li>
  )
}

// ── Films ────────────────────────────────────────────────────────────────────

const pickFilms = (c: City) => c.films

/** Films shot in a country or city, by filming location. */
export function FilmsTab({ country, city, places, loading, onSelectCity, decade, onClearDecade }: PlaceTabProps) {
  const pick = useCallback((c: City) => (decade === null ? pickFilms(c) : c.films.filter((film) => inDecade(film.year, decade))), [decade])
  const { items, topCities } = useItems<Film>(places, city, pick)
  const { t, countryName } = useI18n()
  const where = city?.name ?? countryName(country)
  const when = decade === null ? null : t.decade.inThe(decade)

  return (
    <section aria-labelledby="films-heading">
      <h3 id="films-heading" className="font-display text-[26px] leading-8">
        {t.places.filmedIn(where)}
        <DecadeChip decade={decade} onClear={onClearDecade} />
      </h3>
      <p className="mt-0.5 text-[12.5px] leading-5 text-lo">
        {items.length > 0
          ? t.places.filmsSummary(items.length, when)
          : loading
            ? t.places.findingFilms
            : ''}
      </p>
      <CityChips cities={topCities} onSelect={onSelectCity} />
      {loading && !places ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="mt-4">
          <StateMessage icon={<Clapperboard />} title={t.places.noFilms}>
            {when === null ? t.places.noFilmsText(where) : t.places.noFilmsDecade(where, when)}
          </StateMessage>
        </div>
      ) : (
        <Paged
          key={city?.id ?? 'all'}
          items={items}
          render={({ item, city: home }) => <FilmRow key={item.id} film={item} city={city ? null : home} onSelectCity={onSelectCity} />}
        />
      )}
    </section>
  )
}

function FilmRow({ film, city, onSelectCity }: { film: Film; city: City | null; onSelectCity: (city: City) => void }) {
  const { t } = useI18n()
  return (
    <li className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]">
      <Poster film={film} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-5 text-hi">{film.name}</p>
        <p className="truncate text-[12px] leading-5 text-mid">
          {[film.director && t.places.directedBy(film.director), film.year].filter(Boolean).join(' · ')}
        </p>
        {city && <CityLink city={city} onSelect={onSelectCity} />}
      </div>
      <div className="flex items-center gap-1">
        {film.imdb && (
          <a
            href={`https://www.imdb.com/title/${film.imdb}/`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.common.onImdb(film.name)}
            title="IMDb"
            className="rounded-md bg-[#f5c518] px-1.5 py-0.5 font-sans text-[11px] font-extrabold tracking-tight text-black transition hover:brightness-110"
          >
            IMDb
          </a>
        )}
        <a
          href={wikipedia(film.id)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.common.onWikipedia(film.name)}
          title={t.common.wikipedia}
          className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
        >
          <BookOpen />
        </a>
      </div>
    </li>
  )
}

/** The film's poster, or a clapperboard tile with the year when Wikipedia has none. */
function Poster({ film }: { film: Film }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      aria-hidden
      className="relative flex h-16 w-11 flex-col items-center justify-end overflow-hidden rounded-md bg-[linear-gradient(160deg,color-mix(in_oklch,var(--accent)_38%,#1a2240),#0b1020_70%)] pb-1 shadow-[0_6px_16px_-6px_rgb(0_0_0/0.6)] ring-1 ring-white/10"
    >
      <Clapperboard className="mb-auto mt-2.5 size-3.5 text-hi/50" />
      <span className="font-mono text-[9.5px] text-hi/70">{film.year ?? ''}</span>
      {film.poster && !failed && (
        <img
          src={film.poster}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  )
}
