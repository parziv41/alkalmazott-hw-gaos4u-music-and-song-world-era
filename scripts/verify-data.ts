// Checks src/data/countries.json, then runs every genre's Discogs search through the real
// proxy and fallback pipeline, so mapping mistakes surface before users see an empty state.
//
//   node scripts/verify-data.ts               all countries (needs DISCOGS_TOKEN in .env.local)
//   node scripts/verify-data.ts --only=br,jp  a few countries
//   node scripts/verify-data.ts --offline     static checks only
import { hasFlag } from 'country-flag-icons'
import world from 'world-atlas/countries-110m.json' with { type: 'json' }
import { GET } from '../api/discogs/search.ts'
import data from '../src/data/countries.json' with { type: 'json' }
import { searchReleases, type SearchFetcher } from '../src/services/discogsApi.ts'
import type { DiscogsSearchResponse } from '../src/types/discogs.ts'
import type { CuratedCountry } from '../src/types/music.ts'

const countries = data as CuratedCountry[]
const args = process.argv.slice(2)
const offline = args.includes('--offline')
const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).toLowerCase().split(',')

const REQUEST_GAP_MS = 1100 // Discogs allows 60 authenticated requests per minute.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const errors: string[] = []
const warnings: string[] = []

// ── Static checks ──────────────────────────────────────────────────────────────
const atlasIds = new Set(
  (world as unknown as { objects: { countries: { geometries: { id?: string }[] } } }).objects.countries.geometries.map((g) => g.id),
)
const seen = new Set<string>()
for (const country of countries) {
  const where = `${country.name} (${country.iso2})`
  if (seen.has(country.id)) errors.push(`${where}: duplicate id ${country.id}`)
  seen.add(country.id)
  if (!hasFlag(country.iso2)) errors.push(`${where}: no flag for ${country.iso2}`)
  if (!atlasIds.has(country.id) && !country.small) errors.push(`${where}: not in the 110m atlas, so it must be marked "small"`)
  if (country.genres.length < 3 || country.genres.length > 5) errors.push(`${where}: has ${country.genres.length} genres (3–5 expected)`)
}
console.log(`Static checks: ${countries.length} countries, ${countries.reduce((n, c) => n + c.genres.length, 0)} genres.`)

// ── Live Discogs checks ────────────────────────────────────────────────────────
if (!offline) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // Fine when DISCOGS_TOKEN comes from the environment instead.
  }
  if (!process.env.DISCOGS_TOKEN) {
    console.error('\nDISCOGS_TOKEN is missing. Add it to .env.local, or run with --offline for static checks only.')
    process.exit(1)
  }

  let sawCommunity = false
  const fetcher: SearchFetcher = async (params) => {
    for (let attempt = 0; ; attempt++) {
      await sleep(REQUEST_GAP_MS)
      const response = await GET(new Request(`http://localhost/api/discogs/search?${params}`))
      if (response.status === 429 && attempt < 3) {
        console.log('  …rate limited, waiting 15 s')
        await sleep(15_000)
        continue
      }
      if (!response.ok) throw new Error(`Discogs ${response.status}: ${await response.text()}`)
      const body = (await response.json()) as DiscogsSearchResponse
      sawCommunity ||= body.results.some((result) => result.community)
      return body
    }
  }

  const selected = only ? countries.filter((c) => only.includes(c.iso2.toLowerCase())) : countries
  for (const country of selected) {
    console.log(`\n${country.name}`)
    for (const genre of country.genres) {
      try {
        const { releases, match } = await searchReleases(country, genre, fetcher)
        const icon = releases.length >= 3 ? (match === 'exact' ? '✓' : '~') : '✗'
        const titles = releases.map((r) => `${r.artist} – ${r.title}${r.year ? ` (${r.year})` : ''}`).join(' | ')
        console.log(`  ${icon} ${genre.name.padEnd(22)} ${match.padEnd(7)} ${titles}`)
        if (releases.length < 3) errors.push(`${country.name} › ${genre.name}: only ${releases.length} releases`)
        else if (match !== 'exact') warnings.push(`${country.name} › ${genre.name}: matched via ${match} fallback`)
      } catch (error) {
        console.log(`  ✗ ${genre.name}: ${error}`)
        errors.push(`${country.name} › ${genre.name}: ${error}`)
      }
    }
  }
  if (!sawCommunity) warnings.push('Search results had no `community` counts, so "most collected" sorting falls back to relevance.')
}

// ── Summary ────────────────────────────────────────────────────────────────────
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ${warnings.join('\n  ')}`)
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log('\nAll checks passed.')
