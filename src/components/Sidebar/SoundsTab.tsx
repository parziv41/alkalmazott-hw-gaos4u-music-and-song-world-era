import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../../i18n/context'
import { discogsWebSearchUrl } from '../../services/discogsApi'
import type { Country, Genre } from '../../types/music'
import { GenreSelector } from './GenreSelector'
import { ReleaseResults } from './ReleaseResults'

/** The curated layer: a country's defining genres and their most-collected records on Discogs. */
export function SoundsTab({ country, genre, onSelectGenre }: { country: Country; genre: Genre; onSelectGenre: (genre: Genre) => void }) {
  const { t, genreText } = useI18n()
  const { blurb, era } = genreText(country, genre)
  return (
    <>
      <section aria-labelledby="genres-heading">
        <h3 id="genres-heading" className="label-mono mb-3">
          {t.sounds.local}
        </h3>
        <GenreSelector country={country} genre={genre} onSelect={onSelectGenre} />
      </section>

      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={genre.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[28px] leading-8">{genre.name}</h3>
              <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[11px] text-accent">{era}</span>
            </div>
            <p className="mt-1.5 text-[14px] leading-[22px] text-mid">{blurb}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-7">
        <ReleaseResults country={country} genre={genre} />
      </div>
      <a
        href={discogsWebSearchUrl(country, genre)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-[12px] font-medium text-accent hover:underline"
      >
        {t.sounds.moreOnDiscogs(genre.name)}
      </a>
    </>
  )
}
