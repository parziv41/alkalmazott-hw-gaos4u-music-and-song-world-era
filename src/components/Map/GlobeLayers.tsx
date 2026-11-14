import { Clapperboard, Music2, Radio } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import { countriesById } from '../../data'
import type { Country } from '../../types/music'
import type { Settlement } from '../../types/places'
import type { CityCluster } from '../../utils/cityClusters'
import { useI18n } from '../../i18n/context'
import { accentColor, cn } from '../../utils/misc'

type Register<T> = (id: string, element: T | null) => void

/**
 * One <path> per country. Their `d` attributes are written by the globe renderer every frame,
 * so this only re-renders when the selection changes; hover and focus are handled in CSS.
 */
export const CountryPaths = memo(function CountryPaths({
  ids,
  selectable,
  selectedId,
  charting,
  heat,
  tone = 'amber',
  register,
}: {
  ids: string[]
  selectable: Set<string>
  selectedId: string | null
  /** Countries with songs in the open global chart, which light up. */
  charting: ReadonlySet<string>
  /** Time machine: how much of each country's colour shows (percent), by what was made there. */
  heat: ReadonlyMap<string, number> | null
  /** Amber for the time machine, the selected country's accent for the similarity map. */
  tone?: 'amber' | 'accent'
  register: Register<SVGPathElement>
}) {
  return (
    <g className={cn('countries', selectedId && 'has-selection', charting.size > 0 && 'has-charting', heat && 'has-heat', heat && `tone-${tone}`)}>
      {ids.map((id) => {
        const country = selectable.has(id) ? countriesById.get(id) : undefined
        return (
          <path
            key={id}
            ref={(element) => register(id, element)}
            data-geo={id}
            data-country={country ? id : undefined}
            className={cn('country', country && 'has-data', id === selectedId && 'is-selected', charting.has(id) && 'is-charting')}
            style={
              country
                ? ({ '--country-accent': accentColor(country.hue), '--heat-mix': heat ? `${heat.get(id) ?? 4}%` : undefined } as CSSProperties)
                : undefined
            }
            aria-hidden
          />
        )
      })}
    </g>
  )
})

/** Dots for island states too small to click at globe scale. */
export const SmallCountryDots = memo(function SmallCountryDots({
  countries,
  selectedId,
  register,
}: {
  countries: Country[]
  selectedId: string | null
  register: Register<SVGGElement>
}) {
  return (
    <g>
      {countries.map((country) => (
        <g
          key={country.id}
          ref={(element) => register(country.id, element)}
          data-geo={country.id}
          data-country={country.id}
          className={cn('marker', country.genres.length > 0 && 'is-curated', country.id === selectedId && 'is-selected')}
          style={{ '--country-accent': accentColor(country.hue) } as CSSProperties}
          aria-hidden
        >
          <circle r={10} className="marker-hit" />
          {country.genres.length > 0 && <circle r={3.5} className="marker-ping" />}
          <circle r={country.genres.length > 0 ? 3.5 : 2.5} className="marker-dot" />
        </g>
      ))}
    </g>
  )
})

/**
 * City markers, in an HTML layer over the globe so they can hold text and icons. The renderer
 * positions them each frame from their data-lon / data-lat, and when the camera rests gives the
 * heaviest ones on screen a `has-label` class (their data-weight decides).
 */
export const CityMarkers = memo(function CityMarkers({
  clusters,
  selectedCityId,
  selectedCountryId,
  register,
  onOpen,
}: {
  clusters: CityCluster[]
  selectedCityId: string | null
  selectedCountryId: string | null
  register: Register<HTMLElement>
  onOpen: (cluster: CityCluster) => void
}) {
  const { t, countryName } = useI18n()
  return (
    <div className="city-layer" data-count={clusters.length}>
      {clusters.map((cluster) => {
        const [{ city, country }] = cluster.members
        // A cluster led by one city behaves like that city; a balanced one zooms in when clicked.
        const many = !cluster.lead
        const others = cluster.members.length - 1
        const weight = cluster.artists + cluster.films
        const size = weight >= 60 ? 'lg' : weight >= 12 ? 'md' : 'sm'
        const counts = `${t.common.artists(cluster.artists)}, ${t.common.films(cluster.films)}`
        const label = many
          ? t.globe.clusterLabel(cluster.members.length, city.name, counts)
          : t.globe.cityLabel(city.name, countryName(country), others, counts, cluster.chart)
        return (
          <button
            key={cluster.key}
            type="button"
            ref={(element) => register(cluster.key, element)}
            data-lon={cluster.lon}
            data-lat={cluster.lat}
            data-city={many ? undefined : city.id}
            data-name={city.name}
            data-weight={weight}
            aria-label={label}
            onClick={() => onOpen(cluster)}
            className={cn(
              'city-marker',
              `is-${size}`,
              many && 'is-cluster',
              city.id === selectedCityId && 'is-selected',
              selectedCountryId && (country.id === selectedCountryId ? 'is-home' : 'is-foreign'),
            )}
            style={{ '--country-accent': accentColor(country.hue) } as CSSProperties}
          >
            <span className="city-dot">{many ? <span className="city-count">{cluster.members.length}</span> : null}</span>
            <span className="city-label">
              <span className="city-name">
                {city.name}
                {others > 0 && <span className="city-more"> +{others}</span>}
              </span>
              <span className="city-stats">
                {cluster.artists > 0 && (
                  <span>
                    <Music2 aria-hidden /> {cluster.artists}
                  </span>
                )}
                {cluster.films > 0 && (
                  <span>
                    <Clapperboard aria-hidden /> {cluster.films}
                  </span>
                )}
                {cluster.chart && <Radio aria-hidden className="city-chart" />}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
})

/** Names of towns and villages that fit between the music markers; clicking one opens it. */
export const SettlementLabels = memo(function SettlementLabels({
  settlements,
  selectedId,
  register,
  onOpen,
}: {
  settlements: Settlement[]
  selectedId: string | null
  register: Register<HTMLElement>
  onOpen: (settlement: Settlement) => void
}) {
  return (
    <div className="city-layer">
      {settlements.map((settlement) => (
        <button
          key={settlement.id}
          type="button"
          ref={(element) => register(settlement.id, element)}
          data-lon={settlement.lon}
          data-lat={settlement.lat}
          data-settlement={settlement.id}
          aria-label={`${settlement.name}${settlement.region ? `, ${settlement.region}` : ''}`}
          onClick={() => onOpen(settlement)}
          className={cn('settlement-label', settlement.id === selectedId && 'is-selected')}
        >
          {settlement.name}
        </button>
      ))}
    </div>
  )
})

export type WaterLabel = {
  id: string
  text: string
  lon: number
  lat: number
  /** A point a little downstream, for turning a river's name along it. */
  lon2?: number
  lat2?: number
  kind: 'river' | 'lake'
}

/** Names of the biggest rivers and lakes in view; placed and turned by the renderer. */
export const WaterLabels = memo(function WaterLabels({ labels, register }: { labels: WaterLabel[]; register: Register<HTMLElement> }) {
  return (
    <div className="city-layer" aria-hidden>
      {labels.map((label) => (
        <span
          key={label.id}
          ref={(element) => register(label.id, element)}
          data-lon={label.lon}
          data-lat={label.lat}
          data-lon2={label.lon2}
          data-lat2={label.lat2}
          className={cn('water-label', label.kind === 'lake' && 'is-lake')}
        >
          {label.text}
        </span>
      ))}
    </div>
  )
})

/** The time machine's centres of gravity: where, on average, the decade's music and films came from. */
export function GravityMarkers({
  label,
  showMusic,
  showFilms,
  register,
}: {
  label: string
  /** Whether to show music's and film's centres (off by layer, or when the decade has too few). */
  showMusic: boolean
  showFilms: boolean
  register: Register<HTMLElement>
}) {
  const { t } = useI18n()
  return (
    <div className="city-layer" aria-hidden>
      {showMusic && (
        <div ref={(element) => register('a', element)} className="gravity is-music">
          <span className="gravity-dot">
            <Music2 />
          </span>
          <span className="gravity-label">{t.globe.musicCentre(label)}</span>
        </div>
      )}
      {showFilms && (
        <div ref={(element) => register('f', element)} className="gravity is-films">
          <span className="gravity-dot">
            <Clapperboard />
          </span>
          <span className="gravity-label">{t.globe.filmCentre(label)}</span>
        </div>
      )}
    </div>
  )
}
