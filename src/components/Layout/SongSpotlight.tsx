import { CloudOff, Earth, LoaderCircle, X } from 'lucide-react'
import { motion } from 'motion/react'
import { countriesByIso2 } from '../../data'
import type { SpotlightTrack } from '../../hooks/useSpotlight'
import { useI18n } from '../../i18n/context'
import type { ChartIndex } from '../../types/charts'
import type { Country } from '../../types/music'
import { CoverImage } from '../UI/CoverImage'
import { Flag } from '../UI/Flag'

type SongSpotlightProps = {
  track: SpotlightTrack
  index: ChartIndex | undefined
  positions: { iso2: string; rank: number }[]
  loading: boolean
  failed: boolean
  onOpenCountry: (country: Country) => void
  onShowOnGlobe: () => void
  onClose: () => void
}

/** Where a song is in the national charts right now; the same countries light up on the globe. */
export function SongSpotlight({ track, index, positions, loading, failed, onOpenCountry, onShowOnGlobe, onClose }: SongSpotlightProps) {
  const charted = positions.flatMap(({ iso2, rank }) => {
    const country = countriesByIso2.get(iso2.toLowerCase())
    return country ? [{ country, rank }] : []
  })
  const checked = index ? Object.keys(index.charts).length : 0
  const { t, countryName } = useI18n()

  return (
    <motion.section
      aria-label={t.spotlight.region(track.title)}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className="glass pointer-events-auto w-[min(560px,calc(100vw-24px))] rounded-2xl p-3"
    >
      <div className="flex items-start gap-3">
        <CoverImage src={track.artwork} className="relative size-11 shrink-0 rounded-lg ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-lo">
            <Earth aria-hidden className="size-3.5 text-accent" /> {t.spotlight.heading}
          </p>
          <p className="truncate text-[14px] font-medium text-hi">
            {track.title} <span className="font-normal text-mid">· {track.artist}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="grid size-8 shrink-0 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
        >
          <X />
        </button>
      </div>

      <div className="mt-2.5" aria-live="polite">
        {loading && !index ? (
          <p className="flex items-center gap-2 text-[12.5px] text-mid">
            <LoaderCircle className="size-3.5 animate-spin" /> {t.spotlight.loading}
          </p>
        ) : failed && !index ? (
          <p className="flex items-center gap-2 text-[12.5px] text-mid">
            <CloudOff className="size-3.5" /> {t.spotlight.failed}
          </p>
        ) : charted.length === 0 ? (
          <p className="text-[12.5px] text-mid">{t.spotlight.none(checked)}</p>
        ) : (
          <>
            <p className="mb-2 flex items-baseline justify-between gap-2 text-[12.5px] text-mid">
              <span>{t.spotlight.inCharts(charted.length, checked)}</span>
              <button type="button" onClick={onShowOnGlobe} className="shrink-0 font-medium text-accent hover:underline">
                {t.spotlight.seeOnGlobe}
              </button>
            </p>
            <div className="scroll-thin flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {charted.map(({ country, rank }) => (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => onOpenCountry(country)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-1.5 pr-2 text-[12px] text-hi ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <Flag iso2={country.iso2} className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-white/15" />
                  {countryName(country)}
                  <span className="rounded-full bg-accent-soft px-1.5 font-mono text-[10.5px] text-accent">#{rank}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {index && !index.complete && <p className="mt-1.5 text-[11px] text-lo">{t.spotlight.partial}</p>}
      </div>
    </motion.section>
  )
}
