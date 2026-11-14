import { useI18n } from '../../i18n/context'
import { cn } from '../../utils/misc'

export type ChartMode = 'now' | 'alltime'

/** "Right now" (Shazam's global chart) or "All time" (the Top 30 from 40 countries' number ones). */
export function ChartModeSwitch({ mode, onMode }: { mode: ChartMode; onMode: (mode: ChartMode) => void }) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t.allTime.modes} className="relative inline-flex rounded-full bg-white/[0.05] p-0.5 text-[12.5px] ring-1 ring-white/10">
      {(
        [
          ['now', t.allTime.now],
          ['alltime', t.allTime.allTime],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => onMode(id)}
          className={cn('rounded-full px-3 py-1 font-medium transition', mode === id ? 'bg-accent text-on-accent' : 'text-mid hover:text-hi')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
