import { CloudOff, Disc3, KeyRound, RotateCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useDelayedFlag } from '../../hooks/dom'
import { useReleases } from '../../hooks/useReleases'
import { useI18n, type I18n } from '../../i18n/context'
import { DiscogsError, discogsWebSearchUrl } from '../../services/discogsApi'
import type { Country, Genre, MatchQuality } from '../../types/music'
import { RecordRow, RecordRowSkeleton } from '../UI/RecordRow'
import { StateMessage } from '../UI/StateMessage'
import { VinylLoader } from '../UI/VinylLoader'

const LOADER_DELAY_MS = 120

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { duration: 0.2 },
}

function matchNote(match: MatchQuality, country: Country, genre: Genre, { t, countryName }: I18n): string | null {
  if (match === 'global') return t.sounds.global(countryName(country))
  if (match === 'keyword') return t.sounds.keyword(genre.discogs.keyword ?? genre.name)
  return null
}

export function ReleaseResults({ country, genre }: { country: Country; genre: Genre }) {
  const query = useReleases(country, genre)
  const i18n = useI18n()
  const { t } = i18n
  const showLoader = useDelayedFlag(query.isPending, LOADER_DELAY_MS)
  const searchUrl = discogsWebSearchUrl(country, genre)
  const error = query.error ?? query.failureReason
  const rateLimited = error instanceof DiscogsError && error.status === 429

  const releases = query.data?.releases ?? []
  const state = query.isPending
    ? showLoader
      ? 'loading'
      : 'waiting'
    : query.isError
      ? 'error'
      : releases.length === 0
        ? 'empty'
        : 'success'

  const note = query.data ? matchNote(query.data.match, country, genre, i18n) : null
  const announcement =
    state === 'success'
      ? t.sounds.announce.loaded(releases.length, genre.name)
      : state === 'loading'
        ? t.sounds.announce.loading(genre.name)
        : state === 'empty'
          ? t.sounds.announce.none(genre.name)
          : state === 'error'
            ? t.sounds.announce.failed
            : ''

  return (
    <section aria-labelledby="records-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="records-heading" className="label-mono">
          {t.sounds.records}
        </h3>
        <span className="text-[11px] text-lo">{t.sounds.viaDiscogs}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="mt-3 min-h-[336px]">
        <AnimatePresence mode="wait" initial={false}>
          {state === 'loading' && (
            <motion.div key="loading" {...fade}>
              <div className="mb-1 flex items-center gap-2.5 text-[13px] text-mid">
                <VinylLoader className="size-5" />
                {rateLimited ? t.sounds.rateLimited : t.sounds.loadingRecords}
              </div>
              <ul>
                <RecordRowSkeleton />
                <RecordRowSkeleton />
                <RecordRowSkeleton />
              </ul>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div key={`records-${country.id}-${genre.id}`} {...fade}>
              <motion.ol variants={listVariants} initial="hidden" animate="show" className="space-y-1">
                {releases.map((release, index) => (
                  <RecordRow key={release.id} release={release} rank={index + 1} />
                ))}
              </motion.ol>
              {note && <p className="mt-3 text-[12px] leading-5 text-lo">{note}</p>}
            </motion.div>
          )}

          {state === 'empty' && (
            <motion.div key="empty" {...fade}>
              <StateMessage
                icon={<Disc3 />}
                title={t.sounds.noRecords}
                action={
                  <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-accent hover:underline">
                    {t.sounds.searchDiscogs}
                  </a>
                }
              >
                {t.sounds.noRecordsText(genre.name, i18n.countryName(country))}
              </StateMessage>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div key="error" {...fade}>
              {error instanceof DiscogsError && error.code === 'missing_token' ? (
                <StateMessage icon={<KeyRound />} title={t.sounds.tokenMissing}>
                  {t.sounds.tokenMissingText}
                </StateMessage>
              ) : (
                <StateMessage
                  icon={<CloudOff />}
                  title={rateLimited ? t.sounds.resting : t.sounds.unreachable}
                  action={
                    <button
                      type="button"
                      onClick={() => query.refetch()}
                      className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-hi ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <RotateCw className="size-3.5" /> {t.common.tryAgain}
                    </button>
                  }
                >
                  {rateLimited ? t.sounds.restingText : t.sounds.connection}
                </StateMessage>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
