import { Clapperboard, History, Music2, Pause, Play, Radio, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useHitsIndex } from '../../hooks/useHits'
import { useI18n } from '../../i18n/context'
import { cn } from '../../utils/misc'
import type { Timeline } from '../../types/places'
import type { Layers } from '../../utils/cityClusters'

const STEP_MS = 1500
const SCALE_LABELS = new Set([1900, 1950, 2000])
const NO_DECADES: number[] = []

type TimeMachineProps = {
  timeline: Timeline | undefined
  decade: number
  layers: Layers
  onDecade: (decade: number) => void
  onClose: () => void
}

/**
 * The time machine: a decade slider with play. The globe shows where that decade's artists were
 * born (or bands formed) and films were made, and how the centre of gravity moves.
 */
export function TimeMachine({ timeline, decade, layers, onDecade, onClose }: TimeMachineProps) {
  const [playRequested, setPlayRequested] = useState(false)
  const { t, number } = useI18n()
  const decades = timeline?.decades ?? NO_DECADES
  const index = Math.max(0, decades.indexOf(decade))
  const artists = timeline?.centers.a[index]?.[2] ?? 0
  const films = timeline?.centers.f[index]?.[2] ?? 0
  const { data: hitsIndex } = useHitsIndex(true)
  const charted = useMemo(
    () => (hitsIndex ? Object.values(hitsIndex).filter((years) => years.some((year) => year >= decade && year < decade + 10)).length : 0),
    [hitsIndex, decade],
  )
  // Playing stops by itself at the last decade.
  const playing = playRequested && index < decades.length - 1

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => onDecade(decades[index + 1]), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, decades, onDecade])

  const togglePlay = () => {
    // From the end, play starts over.
    if (!playing && index >= decades.length - 1) onDecade(decades[0])
    setPlayRequested(!playing)
  }

  return (
    <motion.section
      aria-label={t.timeMachine.region}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className="glass pointer-events-auto w-[min(560px,calc(100vw-24px))] rounded-2xl px-3 py-2.5"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? t.common.pause : t.timeMachine.play}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition active:scale-95 [&_svg]:size-4"
        >
          {playing ? <Pause fill="currentColor" /> : <Play className="translate-x-px" fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex items-center gap-1.5 font-display text-[22px] leading-6" aria-live="polite">
              <History aria-hidden className="size-4 text-accent" />
              {t.decade.label(decade)}
            </p>
            <p className="flex shrink-0 items-center gap-2.5 font-mono text-[11px] text-mid">
              {layers.music && (
                <span className="inline-flex items-center gap-1" title={t.timeMachine.born}>
                  <Music2 aria-hidden className="size-3" /> {number(artists)}
                </span>
              )}
              {layers.films && (
                <span className="inline-flex items-center gap-1" title={t.timeMachine.made}>
                  <Clapperboard aria-hidden className="size-3" /> {number(films)}
                </span>
              )}
              {charted > 0 && (
                <span className="inline-flex items-center gap-1" title={t.timeMachine.charts}>
                  <Radio aria-hidden className="size-3" /> {number(charted)}
                </span>
              )}
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(decades.length - 1, 0)}
            step={1}
            value={index}
            disabled={!decades.length}
            onChange={(event) => {
              setPlayRequested(false)
              onDecade(decades[Number(event.target.value)])
            }}
            aria-label={t.timeMachine.slider}
            aria-valuetext={t.decade.label(decade)}
            className="time-slider mt-1.5 w-full"
          />
          {/* A tick for every stop, each under the thumb's centre at that stop (the 16px thumb never runs
              past the track's ends): the first eleven stops cover 1840–1940, so even spacing would put
              "2000" under the 1970s. */}
          <div aria-hidden className="relative mt-0.5 h-3.5 font-mono text-[9.5px] leading-none text-lo">
            {decades.map((stop, i) => {
              const label = stop < 1850 ? '–1850' : SCALE_LABELS.has(stop) || i === decades.length - 1 ? String(stop) : null
              const at = `calc(8px + (100% - 16px) * ${decades.length > 1 ? i / (decades.length - 1) : 0})`
              return (
                <span
                  key={stop}
                  className={cn('absolute top-0', i === 0 ? '' : i === decades.length - 1 ? '-translate-x-full' : '-translate-x-1/2')}
                  style={{ left: i === 0 ? 0 : i === decades.length - 1 ? '100%' : at }}
                >
                  {label ?? <span className="mx-auto mt-0.5 block h-1.5 w-px bg-white/25" />}
                </span>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.timeMachine.close}
          className="grid size-8 shrink-0 place-items-center self-start rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
        >
          <X />
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-lo">
        {t.timeMachine.note}
      </p>
    </motion.section>
  )
}
