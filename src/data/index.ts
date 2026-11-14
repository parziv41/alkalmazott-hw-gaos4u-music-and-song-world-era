import type { Country, CuratedCountry, Genre } from '../types/music'
import curatedData from './countries.json'
import worldData from './world.json'

type WorldEntry = Omit<Country, 'cityCount' | 'artistCount' | 'filmCount' | 'genres' | 'description' | 'discogsCountry'> & {
  cities: number
  artists: number
  films: number
}

const curated = curatedData as CuratedCountry[]
const curatedById = new Map(curated.map((country) => [country.id, country]))
const world = worldData as WorldEntry[]

function fromWorld({ cities, artists, films, ...entry }: WorldEntry): Country {
  const extra = curatedById.get(entry.id)
  return {
    ...entry,
    small: entry.small || extra?.small,
    cityCount: cities,
    artistCount: artists,
    filmCount: films,
    description: extra?.description,
    discogsCountry: extra?.discogsCountry,
    genres: extra?.genres ?? [],
  }
}

function fromCurated(country: CuratedCountry): Country {
  const [west, south, east, north] = country.bbox
  return { ...country, center: [(west + east) / 2, (south + north) / 2], cityCount: 0, artistCount: 0, filmCount: 0 }
}

const worldIds = new Set(world.map((entry) => entry.id))
export const countries: Country[] = [...world.map(fromWorld), ...curated.filter((c) => !worldIds.has(c.id)).map(fromCurated)].toSorted(
  (a, b) => a.name.localeCompare(b.name),
)

export const countriesById = new Map(countries.map((country) => [country.id, country]))
export const countriesByIso2 = new Map(countries.map((country) => [country.iso2.toLowerCase(), country]))
export const curatedCountries = countries.filter((country) => country.genres.length > 0)

export const allGenres: { country: Country; genre: Genre }[] = curatedCountries.flatMap((country) =>
  country.genres.map((genre) => ({ country, genre })),
)
