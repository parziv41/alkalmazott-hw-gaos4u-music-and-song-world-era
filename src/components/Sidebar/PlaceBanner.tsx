import { ArrowRight, MapPin, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useI18n } from '../../i18n/context'
import type { City, Settlement } from '../../types/places'
import { nearestCity } from '../../utils/settlements'

type PlaceBannerProps = {
  place: Settlement
  cities: City[]
  onSelectCity: (city: City) => void
  onClear: () => void
}

/** A searched town or village: where it is, and the nearest city that has music or films on the map. */
export function PlaceBanner({ place, cities, onSelectCity, onClear }: PlaceBannerProps) {
  const { t } = useI18n()
  const nearest = nearestCity(place, cities)
  const facts = [place.region !== place.name && place.region, place.population > 0 && t.common.people(place.population)]
    .filter(Boolean)
    .join(' · ')

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={t.placeBanner.region(place.name)}
      className="relative mx-6 mt-4 rounded-2xl bg-accent-soft p-3.5 pr-10 ring-1 ring-white/10"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-on-accent [&_svg]:size-4">
          <MapPin />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[24px] leading-7">{place.name}</p>
          {facts && <p className="text-[12.5px] text-mid">{facts}</p>}
          {nearest && nearest.km > 1 && (
            <button
              type="button"
              onClick={() => onSelectCity(nearest.city)}
              className="mt-2 inline-flex items-center gap-1.5 text-left text-[12.5px] font-medium text-accent hover:underline"
            >
              {t.placeBanner.nearest(nearest.city.name, Math.round(nearest.km))}
              <ArrowRight className="size-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={t.placeBanner.clear(place.name)}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-3.5"
      >
        <X />
      </button>
    </motion.section>
  )
}
