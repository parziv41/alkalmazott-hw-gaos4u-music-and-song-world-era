import { countries } from '../data'
import type { ChartTarget } from '../hooks/useChart'
import type { Country } from '../types/music'

/** A place with a chart: a country's national chart or a Shazam city chart. */
export type ChartPlace = { key: string; kind: 'country' | 'city'; name: string; country: Country; iso2: string; target: ChartTarget }

export const nationalPlaces: ChartPlace[] = countries.flatMap((country) => {
  const params: Record<string, string> | null =
    country.chart === 'apple'
      ? { source: 'apple', cc: country.iso2.toLowerCase(), ...(country.shazam ? { fallback: country.shazam } : {}) }
      : country.chart === 'shazam' && country.shazam
        ? { source: 'shazam', country: country.shazam }
        : null
  return params ? [{ key: `country:${country.iso2}`, kind: 'country' as const, name: country.name, country, iso2: country.iso2, target: { scope: 'country' as const, params } }] : []
})

/** A country's national chart as a place to compare with. */
export const nationalPlaceFor = (iso2: string) => nationalPlaces.find((place) => place.iso2 === iso2)

/** A place's name in the interface language: countries are translated, cities keep their own name. */
export const placeName = (place: ChartPlace, countryName: (country: Country) => string) => (place.kind === 'country' ? countryName(place.country) : place.name)
