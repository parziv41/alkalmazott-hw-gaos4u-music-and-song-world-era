import { Description, Title } from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { ArrowDown, ArrowUp, CornerDownLeft, Home, MapPin, Mic2, Music2, Radio, Search, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { allGenres, countries, countriesByIso2 } from '../../data'
import { useArtistSearch, useCatalogueSearch } from '../../hooks/useArtists'
import { useGazetteer } from '../../hooks/useGazetteer'
import { useSongIndex } from '../../hooks/useHits'
import { useSearchCities } from '../../hooks/usePlaces'
import type { SearchCity, Settlement } from '../../types/places'
import { hungarianCountryName, useI18n } from '../../i18n/context'
import { anySongKey, nameKey, searchHits } from '../../utils/hitSearch'
import { fold } from '../../utils/settlements'
import type { ArtistRef } from '../Layout/ArtistCard'
import type { SongRef } from '../Layout/SongCard'
import { Flag } from '../UI/Flag'
import { Kbd } from '../UI/Kbd'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (iso2: string, options?: { genre?: string; city?: string }) => void
  /** A town or village from the gazetteer. */
  onSelectPlace: (settlement: Settlement) => void
  /** A number-one song from the time machine's hits, or any song on Deezer. */
  onSelectSong: (song: SongRef) => void
  /** A musician or band: from the globe's places (with where they come from), or from the hits. */
  onSelectArtist: (artist: ArtistRef) => void
}

const itemClass = 'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-hi'

// English and Hungarian names both match, whichever language the page is in ("Németország" finds Germany).
const searchableCountries = countries.map((country) => ({
  country,
  key: fold(`${country.name} ${hungarianCountryName(country)} ${country.iso2}`),
  region: fold(country.region),
}))
const searchableGenres = allGenres.map((entry) => ({ ...entry, key: fold(`${entry.genre.name} ${entry.country.name} ${entry.genre.era}`) }))

/** Prefix matches first, then matches anywhere; ties go to the heavier entry. */
function rank<T>(items: T[], query: string, key: (item: T) => string, weight: (item: T) => number, limit: number): T[] {
  return items
    .map((item) => {
      const text = key(item)
      const index = text.indexOf(query)
      const wordStart = index === 0 || (index > 0 && /[\s(-]/.test(text[index - 1]))
      return { item, score: index < 0 ? -1 : (index === 0 ? 3 : wordStart ? 2 : 1) * 1e6 + weight(item) }
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item)
}

/** ⌘K search across countries, cities and genres. Lazy-loaded on first open. */
export default function CommandPalette({ open, onOpenChange, onSelect, onSelectPlace, onSelectSong, onSelectArtist }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const { t, lang, countryName, regionName, number } = useI18n()
  const cities = useSearchCities(open)
  const gazetteer = useGazetteer(open)
  const songIndex = useSongIndex(open)
  const artistSearch = useArtistSearch(query, open)
  const catalogue = useCatalogueSearch(query, open)
  const q = fold(query.trim())
  const searchablePlaces = useMemo(() => gazetteer.data?.all.map((place) => ({ place, key: fold(place.name) })) ?? [], [gazetteer.data])

  const results = useMemo(() => {
    if (!q) {
      // Alphabetical in the reader's language.
      const sorted = lang === 'hu' ? countries.toSorted((a, b) => hungarianCountryName(a).localeCompare(hungarianCountryName(b), 'hu')) : countries
      return { countries: sorted, cities: [] as SearchCity[], places: [] as Settlement[], genres: allGenres }
    }
    const musicCities = rank(cities.data ?? [], q, (c) => fold(c.name), (c) => c.artists + c.films + (c.chart ? 50 : 0), 10)
    // Towns and villages, minus the ones already listed as cities with music.
    const listed = new Set(musicCities.map((c) => `${c.iso2}|${fold(c.name)}`))
    const places =
      q.length < 2
        ? []
        : rank(searchablePlaces, q, (p) => p.key, (p) => p.place.population, 24)
            .map((p) => p.place)
            .filter((place) => !listed.has(`${place.iso2}|${fold(place.name)}`))
            .slice(0, 12)
    return {
      countries: rank(searchableCountries, q, (c) => `${c.key} ${c.region}`, (c) => c.country.artistCount, 8).map((c) => c.country),
      cities: musicCities,
      places,
      genres: rank(searchableGenres, q, (g) => g.key, () => 0, 8),
    }
  }, [q, cities.data, searchablePlaces, lang])

  const hits = useMemo(() => (songIndex.data && q.length >= 2 ? searchHits(songIndex.data, query) : { songs: [], artists: [] }), [songIndex.data, q, query])
  // Artists from the places (with where they come from, and their number ones if any), then artists
  // known only from the number-one lists.
  const artists = useMemo((): ArtistRef[] => {
    if (q.length < 2) return []
    const fromPlaces = (artistSearch.data ?? []).map((origin) => ({ name: origin.name, origin, hits: songIndex.data?.byName.get(nameKey(origin.name)) }))
    const listed = new Set(fromPlaces.map((artist) => nameKey(artist.name)))
    const fromHits = hits.artists.filter((artist) => !listed.has(nameKey(artist.name))).map((artist) => ({ name: artist.name, hits: artist }))
    for (const artist of fromHits) listed.add(nameKey(artist.name))
    // Then Deezer's, for anyone the artist index doesn't know (Rúzsa Magdi, a new band).
    const fromDeezer = (catalogue.data?.artists ?? []).filter((artist) => !listed.has(nameKey(artist.name))).map((artist) => ({ name: artist.name, deezer: artist.id }))
    return [...fromPlaces, ...fromHits, ...fromDeezer].slice(0, 8)
  }, [q, artistSearch.data, songIndex.data, hits.artists, catalogue.data])
  // Number ones first (where and when they topped the charts), then any song on Deezer.
  const songs = useMemo((): SongRef[] => {
    if (q.length < 2) return []
    const numberOnes = hits.songs.map((song) => ({ title: song.title, artist: song.artist, hit: song }))
    const listed = new Set(numberOnes.map((song) => anySongKey(song.title, song.artist)))
    // One of each: Deezer has a song on every album and compilation it is on.
    const fromDeezer = (catalogue.data?.tracks ?? [])
      .filter((track) => {
        const key = anySongKey(track.title.replace(/\s*[-–]\s*(live|remaster|edit|version|mix).*$/i, ''), track.artist)
        if (listed.has(key)) return false
        listed.add(key)
        return true
      })
      .map((track) => ({ title: track.title, artist: track.artist, track: track.id, artistId: track.artistId, album: track.album, cover: track.cover }))
    return [...numberOnes.slice(0, 6), ...fromDeezer].slice(0, 10)
  }, [q, hits.songs, catalogue.data])

  const choose = (iso2: string, options?: { genre?: string; city?: string }) => {
    onOpenChange(false)
    setQuery('')
    onSelect(iso2, options)
  }
  const empty = results.countries.length + results.cities.length + results.places.length + results.genres.length + songs.length + artists.length === 0
  const pick = (action: () => void) => {
    onOpenChange(false)
    setQuery('')
    action()
  }
  const choosePlace = (place: Settlement) => {
    onOpenChange(false)
    setQuery('')
    onSelectPlace(place)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t.search.label}
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm"
      contentClassName="glass fixed left-1/2 top-[12vh] z-50 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl"
    >
      <Title className="sr-only">{t.search.title}</Title>
      <Description className="sr-only">{t.search.description}</Description>
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
        <Search className="size-[18px] shrink-0 text-lo" />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={t.search.placeholder}
          className="h-14 flex-1 bg-transparent text-[16px] text-hi outline-none placeholder:text-lo"
        />
        <Kbd>Esc</Kbd>
      </div>

      <Command.List className="scroll-thin max-h-[min(56vh,440px)] overflow-y-auto p-2">
        {empty && (
          <p className="px-3 py-10 text-center text-[14px] text-mid">
            {(cities.isPending || gazetteer.isPending || songIndex.isPending || catalogue.isFetching) && q ? t.search.loading : t.search.empty}
          </p>
        )}

        {results.cities.length > 0 && (
          <Command.Group heading={t.search.cities}>
            {results.cities.map((city) => {
              const country = countriesByIso2.get(city.iso2.toLowerCase())
              if (!country) return null
              const facts = [city.artists > 0 && t.common.artists(city.artists), city.films > 0 && t.common.films(city.films)].filter(Boolean).join(' · ')
              return (
                <Command.Item key={`city-${city.iso2}-${city.id}`} value={`city-${city.iso2}-${city.id}`} onSelect={() => choose(city.iso2, { city: city.id })} className={itemClass}>
                  <span className="grid size-6 place-items-center text-lo">
                    <MapPin className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {city.name}
                    <span className="text-mid"> · {countryName(country)}</span>
                  </span>
                  {city.chart && <Radio aria-label={t.search.hasChart} className="size-3.5 shrink-0 text-accent" />}
                  <span className="shrink-0 font-mono text-[11px] text-lo">{facts}</span>
                </Command.Item>
              )
            })}
          </Command.Group>
        )}

        {results.places.length > 0 && (
          <Command.Group heading={t.search.towns}>
            {results.places.map((place) => {
              const country = countriesByIso2.get(place.iso2.toLowerCase())
              if (!country) return null
              return (
                <Command.Item key={`place-${place.id}`} value={`place-${place.id}`} onSelect={() => choosePlace(place)} className={itemClass}>
                  <span className="grid size-6 place-items-center text-lo">
                    <Home className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {place.name}
                    <span className="text-mid">
                      {' '}
                      · {place.region && place.region !== place.name ? `${place.region}, ` : ''}
                      {countryName(country)}
                    </span>
                  </span>
                  {place.population > 0 && (
                    <span className="shrink-0 font-mono text-[11px] text-lo">{number(place.population)}</span>
                  )}
                </Command.Item>
              )
            })}
          </Command.Group>
        )}

        {results.countries.length > 0 && (
          <Command.Group heading={t.search.countries}>
            {results.countries.map((country) => (
              <Command.Item key={country.id} value={`country-${country.id}`} onSelect={() => choose(country.iso2)} className={itemClass}>
                <Flag iso2={country.iso2} className="h-4 w-6 rounded-[3px] ring-1 ring-white/15" />
                <span className="min-w-0 flex-1 truncate">{countryName(country)}</span>
                <span className="shrink-0 font-mono text-[11px] text-lo">
                  {country.genres.length > 0 ? t.common.sounds(country.genres.length) : regionName(country.region)}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {artists.length > 0 && (
          <Command.Group heading={t.search.artists}>
            {artists.map((artist) => {
              const { origin, hits: numberOnes } = artist
              const country = origin && countriesByIso2.get(origin.iso2.toLowerCase())
              return (
                <Command.Item
                  key={`artist-${origin?.id ?? artist.name}`}
                  value={`artist-${origin?.id ?? artist.name}`}
                  onSelect={() => pick(() => onSelectArtist(artist))}
                  className={itemClass}
                >
                  <span className="grid size-6 place-items-center text-lo">
                    <Mic2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {artist.name}
                    {country && (
                      <span className="text-mid">
                        {' '}
                        · {origin.city}, {countryName(country)}
                      </span>
                    )}
                  </span>
                  {numberOnes && <Trophy aria-label={t.search.hasHits} className="size-3.5 shrink-0 text-accent" />}
                  <span className="shrink-0 font-mono text-[11px] text-lo">
                    {origin?.year ?? (numberOnes ? t.search.artistMeta(numberOnes.songs.length, numberOnes.first, numberOnes.last) : '')}
                  </span>
                </Command.Item>
              )
            })}
          </Command.Group>
        )}

        {songs.length > 0 && (
          <Command.Group heading={t.search.songs}>
            {songs.map((song) => (
              <Command.Item
                key={`song-${song.track ?? `${song.artist}-${song.title}`}`}
                value={`song-${song.track ?? `${song.artist}-${song.title}`}`}
                onSelect={() => pick(() => onSelectSong(song))}
                className={itemClass}
              >
                <span className="grid size-6 place-items-center text-lo">{song.hit ? <Trophy className="size-4" /> : <Music2 className="size-4" />}</span>
                <span className="min-w-0 flex-1 truncate">
                  {song.title}
                  <span className="text-mid"> · {song.artist}</span>
                </span>
                <span className="max-w-[40%] shrink-0 truncate font-mono text-[11px] text-lo">
                  {song.hit ? t.search.songMeta(song.hit.first, song.hit.countries) : song.album}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {results.genres.length > 0 && (
          <Command.Group heading={t.search.genres}>
            {results.genres.map(({ country, genre }) => (
              <Command.Item
                key={`${country.id}-${genre.id}`}
                value={`genre-${country.id}-${genre.id}`}
                onSelect={() => choose(country.iso2, { genre: genre.id })}
                className={itemClass}
              >
                <span className="grid size-6 place-items-center">
                  <Flag iso2={country.iso2} className="h-3 w-[18px] rounded-[2px] opacity-80" />
                </span>
                <span className="flex-1">
                  {genre.name}
                  <span className="text-mid"> · {countryName(country)}</span>
                </span>
                <span className="font-mono text-[11px] text-lo">{genre.era}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-lo">
        <span className="flex items-center gap-1.5">
          <Kbd>
            <ArrowUp className="size-3" />
          </Kbd>
          <Kbd>
            <ArrowDown className="size-3" />
          </Kbd>
          {t.search.navigate}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          {t.search.open}
        </span>
      </div>
    </Command.Dialog>
  )
}
