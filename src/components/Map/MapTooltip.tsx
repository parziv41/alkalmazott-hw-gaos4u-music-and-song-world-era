import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react'
import { useImperativeHandle, useState, type Ref } from 'react'
import { atlasNames } from '../../data/atlas'
import { countriesById } from '../../data'
import { useI18n } from '../../i18n/context'
import { cn } from '../../utils/misc'
import { Flag } from '../UI/Flag'

export type TooltipHandle = {
  update: (x: number, y: number, geoId: string | null) => void
  hide: () => void
}

const TOOLTIP_WIDTH = 260
const SPRING = { stiffness: 700, damping: 50, mass: 0.35 }

/**
 * Cursor-following label. Position goes through spring-smoothed motion values,
 * so moving the mouse never re-renders React; only a change of country does.
 */
export function MapTooltip({
  ref,
  containerWidth,
  note,
}: {
  ref: Ref<TooltipHandle>
  containerWidth: number
  /** A line that replaces the country's usual facts (the time machine's counts for the decade). */
  note?: (countryId: string) => string | null
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, SPRING)
  const springY = useSpring(y, SPRING)
  const [geoId, setGeoId] = useState<string | null>(null)
  const [flip, setFlip] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      update(px, py, id) {
        x.set(px)
        y.set(py)
        setGeoId(id)
        setFlip(px > containerWidth - TOOLTIP_WIDTH - 24)
      },
      hide() {
        setGeoId(null)
      },
    }),
    [x, y, containerWidth],
  )

  const { t, countryName, regionName } = useI18n()
  const country = geoId ? countriesById.get(geoId) : undefined
  const name = country ? countryName(country) : geoId ? atlasNames.get(geoId) : undefined
  const genres = country?.genres.map((genre) => genre.name) ?? []
  const facts = country
    ? [
        country.chart && t.tooltip.topSongs,
        country.artistCount > 0 && t.common.artists(country.artistCount),
        country.filmCount > 0 && t.common.films(country.filmCount),
      ].filter(Boolean)
    : []

  return (
    <motion.div aria-hidden style={{ x: springX, y: springY }} className="pointer-events-none absolute left-0 top-0 z-10">
      <AnimatePresence>
        {name && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
            className={cn(
              'glass max-w-[260px] rounded-xl px-3 py-2',
              flip ? 'origin-top-right -translate-x-[calc(100%+14px)] translate-y-4' : 'origin-top-left translate-x-4 translate-y-4',
            )}
          >
            <div className="flex items-center gap-2">
              {country && <Flag iso2={country.iso2} className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-white/15" />}
              <span className="whitespace-nowrap text-[13px] font-medium text-hi">{name}</span>
            </div>
            {country ? (
              <>
                {genres.length > 0 && (
                  <p className="mt-1 font-mono text-[11px] leading-4 text-mid">
                    {genres.slice(0, 3).join(' · ')}
                    {genres.length > 3 && <span className="text-lo"> +{genres.length - 3}</span>}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] leading-4 text-lo">{note?.(country.id) ?? (facts.length ? facts.join(' · ') : regionName(country.region))}</p>
              </>
            ) : (
              <p className="mt-0.5 text-[11px] text-lo">{t.tooltip.noData}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
