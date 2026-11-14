import { ArrowLeftRight, LoaderCircle, Waypoints, X } from 'lucide-react'
import { motion } from 'motion/react'
import { countriesByIso2 } from '../../data'
import { useI18n } from '../../i18n/context'
import type { Country } from '../../types/music'
import { TOP, type Neighbour } from '../../utils/similarity'
import { Flag } from '../UI/Flag'

export type SimilarityState = {
  on: boolean
  list: Neighbour[]
  loading: boolean
  failed: boolean
  /** False while the server is still collecting some countries' charts. */
  complete: boolean
  onToggle: () => void
}

type NeighboursProps = {
  country: Country
  similarity: SimilarityState
  onOpenCountry: (country: Country) => void
  onCompare: (iso2: string) => void
}

const SHOWN = 10

/** The countries whose charts are most like this one's; the globe is coloured the same way. */
export function Neighbours({ country, similarity, onOpenCountry, onCompare }: NeighboursProps) {
  const { list, loading, failed, complete, onToggle } = similarity
  const { t, countryName } = useI18n()
  const name = countryName(country)
  const rows = list.flatMap((neighbour) => {
    const other = countriesByIso2.get(neighbour.iso2.toLowerCase())
    return other ? [{ ...neighbour, country: other }] : []
  })
  const alike = rows.filter((row) => row.shared > 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={t.neighbours.region(name)}
      className="mt-4 rounded-2xl bg-white/[0.035] p-3.5 ring-1 ring-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 font-display text-[21px] leading-6">
            <Waypoints aria-hidden className="size-4 text-accent" /> {t.neighbours.title}
          </h4>
          <p className="mt-0.5 text-[12px] leading-5 text-lo">
            {t.neighbours.explain(name, TOP)}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t.neighbours.hide}
          className="grid size-7 shrink-0 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-3.5"
        >
          <X />
        </button>
      </div>

      {loading && !list.length ? (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-mid">
          <LoaderCircle className="size-3.5 animate-spin" /> {t.neighbours.loading}
        </p>
      ) : failed && !list.length ? (
        <p className="mt-3 text-[12.5px] text-mid">{t.neighbours.failed}</p>
      ) : alike.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-mid">{t.neighbours.none(name)}</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {alike.slice(0, SHOWN).map((row) => (
            <li key={row.iso2} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenCountry(row.country)}
                className="min-w-0 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.05]"
              >
                <span className="flex items-center gap-2 text-[13px] text-hi">
                  <Flag iso2={row.country.iso2} className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-white/15" />
                  <span className="truncate">{countryName(row.country)}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-mid">
                    {row.shared}/{TOP}
                  </span>
                </span>
                <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(row.share * 100)}%` }} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => onCompare(row.iso2)}
                aria-label={t.neighbours.compare(name, countryName(row.country))}
                title={t.neighbours.compareTitle}
                className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-accent [&_svg]:size-4"
              >
                <ArrowLeftRight />
              </button>
            </li>
          ))}
        </ol>
      )}
      {!complete && list.length > 0 && <p className="mt-2 text-[11px] text-lo">{t.neighbours.partial}</p>}
    </motion.section>
  )
}
