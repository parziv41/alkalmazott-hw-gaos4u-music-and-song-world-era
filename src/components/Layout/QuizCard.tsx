import { CalendarClock, Gamepad2, LoaderCircle, MapPinned, Pause, Play, RotateCw, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { Quiz, QuizMode } from '../../hooks/useQuiz'
import { useI18n, type I18n } from '../../i18n/context'
import { cn } from '../../utils/misc'
import { MAX_POINTS, QUIZ_DECADES, ROUNDS, scoreShare } from '../../utils/quiz'
import { CoverImage } from '../UI/CoverImage'
import { Flag } from '../UI/Flag'

const MODES: { id: QuizMode; icon: typeof MapPinned }[] = [
  { id: 'where', icon: MapPinned },
  { id: 'when', icon: CalendarClock },
]

/** "Where's it from?": listen, then guess the country on the globe or the decade. */
export function QuizCard({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const { status, mode, rounds, current, total, best } = quiz
  const i18n = useI18n()
  const { t, number: points } = i18n
  const round = rounds.length

  return (
    <motion.section
      aria-label={t.quiz.region}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className="glass pointer-events-auto w-[min(560px,calc(100vw-24px))] rounded-2xl p-3.5"
    >
      <div className="flex items-center gap-2">
        <Gamepad2 aria-hidden className="size-4 text-accent" />
        <p className="flex-1 font-display text-[22px] leading-6">{t.quiz.title}</p>
        {status !== 'intro' && status !== 'finished' && (
          <p className="font-mono text-[11.5px] text-mid">
            {t.quiz.round(Math.max(round, 1), ROUNDS, points(total))}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.quiz.close}
          className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
        >
          <X />
        </button>
      </div>

      {status === 'intro' && (
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {MODES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => quiz.start(id)}
              className="group rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-accent"
            >
              <span className="flex items-center gap-2 text-[15px] font-medium text-hi">
                <Icon aria-hidden className="size-4 text-accent" /> {t.quiz.modes[id].title}
              </span>
              <span className="mt-1 block text-[12.5px] leading-5 text-mid">{t.quiz.modes[id].text}</span>
              <span className="mt-2 flex items-center justify-between text-[11.5px] text-lo">
                <span>{best[id] ? t.quiz.best(points(best[id])) : t.quiz.rounds(ROUNDS)}</span>
                <span className="font-medium text-accent group-hover:underline">{t.quiz.play}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {status === 'loading' && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-mid" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin" />
          {mode === 'where' ? t.quiz.pickingHit : t.quiz.pickingArtist}
        </p>
      )}

      {status === 'error' && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-mid">{t.quiz.noSong}</p>
          <button
            type="button"
            onClick={() => quiz.start(mode)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] text-hi ring-1 ring-white/10 hover:bg-white/10 [&_svg]:size-3.5"
          >
            <RotateCw /> {t.common.tryAgain}
          </button>
        </div>
      )}

      {status === 'playing' && current && (
        <div className="mt-3">
          <Listen quiz={quiz} />
          {mode === 'where' ? (
            <p className="mt-2.5 text-[13px] text-mid" aria-live="polite">
              <MapPinned aria-hidden className="mr-1 inline size-3.5 text-accent" />
              {t.quiz.clickCountry}
            </p>
          ) : (
            <div className="mt-2.5" role="group" aria-label={t.quiz.decadeGroup}>
              <p className="mb-1.5 text-[13px] text-mid">{t.quiz.whenQuestion}</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {QUIZ_DECADES.map((decade) => (
                  <button
                    key={decade}
                    type="button"
                    onClick={() => quiz.guessDecade(decade)}
                    className="rounded-lg bg-white/[0.05] py-1.5 font-mono text-[12.5px] text-hi ring-1 ring-white/10 transition hover:bg-accent hover:text-on-accent"
                  >
                    {t.quiz.decadeButton(decade)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={quiz.skip} className="mt-2 text-[12px] text-lo underline-offset-2 hover:text-mid hover:underline">
            {t.quiz.skip}
          </button>
        </div>
      )}

      {status === 'revealed' && current && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-center gap-3">
            <CoverImage src={current.answer.artwork} className="relative size-14 shrink-0 rounded-lg ring-1 ring-white/10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-hi">{current.answer.title}</p>
              <p className="truncate text-[12.5px] text-mid">{current.answer.artist}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-mid">
                <Flag iso2={current.answer.country.iso2} className="h-3 w-[18px] rounded-[2px] ring-1 ring-white/15" />
                {i18n.countryName(current.answer.country)}
                {current.answer.year && <span className="text-lo">{t.quiz.bornOrFormed(current.answer.year)}</span>}
              </p>
            </div>
            <p className={cn('shrink-0 font-display text-[28px] leading-none', current.points > 0 ? 'text-accent' : 'text-lo')}>+{points(current.points)}</p>
          </div>
          <p className="mt-2 text-[12.5px] text-mid">{guessText(current, i18n)}</p>
          <div className="mt-3 flex items-center gap-2">
            <Listen quiz={quiz} compact />
            <button
              type="button"
              autoFocus
              onClick={quiz.next}
              className="ml-auto rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent transition active:scale-95"
            >
              {round >= ROUNDS ? t.quiz.seeScore : t.quiz.next}
            </button>
          </div>
        </div>
      )}

      {status === 'finished' && (
        <div className="mt-3">
          <p className="font-display text-[34px] leading-9">
            {points(total)} <span className="text-[18px] text-lo">/ {points(ROUNDS * MAX_POINTS)}</span>
          </p>
          <p className="text-[13.5px] text-mid">
            {t.quiz.verdict(scoreShare(total))} {total >= best[mode] && total > 0 ? t.quiz.newBest : t.quiz.yourBest(points(best[mode]))}
          </p>
          <ol className="mt-2.5 flex flex-wrap gap-1.5" aria-label={t.quiz.roundsLabel}>
            {rounds.map((item, index) => (
              <li key={index} className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] py-0.5 pl-1 pr-2 text-[11.5px] text-mid ring-1 ring-white/10">
                <Flag iso2={item.answer.country.iso2} className="h-3 w-[18px] rounded-[2px]" />
                {points(item.points)}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {MODES.map(({ id }) => (
              <button
                key={id}
                type="button"
                onClick={() => quiz.start(id)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-[13px] font-medium transition active:scale-95',
                  id === mode ? 'bg-accent text-on-accent' : 'bg-white/[0.06] text-hi ring-1 ring-white/10 hover:bg-white/10',
                )}
              >
                {id === mode ? t.quiz.again : t.quiz.tryMode(t.quiz.modes[id].title)}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}

function guessText(round: NonNullable<Quiz['current']>, { t, countryName, number }: I18n): string {
  const { guess, answer } = round
  if (!guess) return t.quiz.skipped
  if (guess.country) {
    if (guess.country.id === answer.country.id) return t.quiz.spotOn
    return t.quiz.picked(countryName(guess.country), number(Math.round(guess.km ?? 0)))
  }
  if (guess.decade !== undefined && answer.decade !== undefined) {
    return guess.decade === answer.decade ? t.quiz.rightDecade : t.quiz.wrongDecade(guess.decade, answer.decade)
  }
  return ''
}

/** Play/pause and how far into the 30 seconds the song is. */
function Listen({ quiz, compact = false }: { quiz: Quiz; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div className={cn('flex items-center gap-2.5', compact ? 'w-40' : 'w-full')}>
      <button
        type="button"
        onClick={quiz.togglePlay}
        aria-label={quiz.playing ? t.common.pause : t.common.play}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition active:scale-95 [&_svg]:size-4"
      >
        {quiz.playing ? <Pause fill="currentColor" /> : <Play className="translate-x-px" fill="currentColor" />}
      </button>
      <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${quiz.progress * 100}%` }} />
      </div>
    </div>
  )
}
