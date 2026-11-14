import { createContext, use } from 'react'
import type { Country, Genre } from '../types/music'
import { en, type Messages } from './en'
import { hu } from './hu'

export type Lang = 'en' | 'hu'

/** src/data/countries.hu.json: the curated introductions and genre notes in Hungarian, by country id. */
export type CuratedTranslation = Record<string, { description: string; genres: Record<string, { blurb: string; era: string }> }>

export type I18n = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Messages
  /** The country's name in the current language. */
  countryName: (country: { iso2: string; name: string }) => string
  regionName: (region: string) => string
  number: (value: number) => string
  /** The curated introduction and genre notes in the current language (English until the translation loads). */
  description: (country: Country) => string | undefined
  genreText: (country: Country, genre: Genre) => { blurb: string; era: string }
}

const MESSAGES: Record<Lang, Messages> = { en, hu }

// Where the browser's Hungarian country names are outdated or awkward.
const HU_NAMES: Record<string, string> = {
  CD: 'Kongói Demokratikus Köztársaság',
  CG: 'Kongói Köztársaság',
  PS: 'Palesztina',
  SZ: 'Eszvatini',
  MM: 'Mianmar',
  TR: 'Törökország',
}

const HU_REGIONS: Record<string, string> = {
  'Australia and New Zealand': 'Ausztrália és Új-Zéland',
  Caribbean: 'Karib-térség',
  'Central Africa': 'Közép-Afrika',
  'Central Asia': 'Közép-Ázsia',
  'East Africa': 'Kelet-Afrika',
  'East Asia': 'Kelet-Ázsia',
  'Eastern Asia': 'Kelet-Ázsia',
  'Eastern Europe': 'Kelet-Európa',
  Europe: 'Európa',
  'Latin America and the Caribbean': 'Latin-Amerika és a Karib-térség',
  Melanesia: 'Melanézia',
  Micronesia: 'Mikronézia',
  'North Africa': 'Észak-Afrika',
  'North America': 'Észak-Amerika',
  'Northern Africa': 'Észak-Afrika',
  'Northern America': 'Észak-Amerika',
  'Northern Europe': 'Észak-Európa',
  Polynesia: 'Polinézia',
  'South America': 'Dél-Amerika',
  'South Asia': 'Dél-Ázsia',
  'South-eastern Asia': 'Délkelet-Ázsia',
  'Southeast Asia': 'Délkelet-Ázsia',
  'Southern Africa': 'Afrika déli része',
  'Southern Asia': 'Dél-Ázsia',
  'Southern Europe': 'Dél-Európa',
  'Sub-Saharan Africa': 'Szubszaharai Afrika',
  'West Africa': 'Nyugat-Afrika',
  'West Asia': 'Nyugat-Ázsia',
  'Western Asia': 'Nyugat-Ázsia',
  'Western Europe': 'Nyugat-Európa',
}

const huNames = new Map<string, string>()
let regionNames: Intl.DisplayNames | null | undefined

function hungarianName(iso2: string, fallback: string): string {
  const code = iso2.toUpperCase()
  const cached = huNames.get(code)
  if (cached) return cached
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['hu'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  let name = HU_NAMES[code]
  if (!name) {
    try {
      const display = regionNames?.of(code)
      name = display && display !== code ? display : fallback
    } catch {
      name = fallback
    }
  }
  huNames.set(code, name)
  return name
}

export function createI18n(lang: Lang, setLang: (lang: Lang) => void, curated: CuratedTranslation | null): I18n {
  const t = MESSAGES[lang]
  const format = new Intl.NumberFormat(t.locale)
  return {
    lang,
    setLang,
    t,
    countryName: (country) => (lang === 'hu' ? hungarianName(country.iso2, country.name) : country.name),
    regionName: (region) => (lang === 'hu' ? (HU_REGIONS[region] ?? region) : region),
    number: (value) => format.format(value),
    description: (country) => (lang === 'hu' ? (curated?.[country.id]?.description ?? country.description) : country.description),
    genreText: (country, genre) => {
      const translated = lang === 'hu' ? curated?.[country.id]?.genres[genre.id] : undefined
      return translated ?? { blurb: genre.blurb, era: genre.era }
    },
  }
}

export const I18nContext = createContext<I18n>(createI18n('en', () => {}, null))

export const useI18n = () => use(I18nContext)

/** Hungarian names of every country, for search in either language. */
export const hungarianCountryName = (country: { iso2: string; name: string }) => hungarianName(country.iso2, country.name)
