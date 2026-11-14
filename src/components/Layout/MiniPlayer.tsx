import { ArrowUpRight, Pause, Play, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { usePlayer } from '../../hooks/usePlayer'
import { useI18n } from '../../i18n/context'
import { cn } from '../../utils/misc'
import { CoverImage } from '../UI/CoverImage'

/**
 * The preview that's playing: cover, title, progress and controls. Floats over the globe, or
 * `docked` at the foot of the desktop panel so it never covers the legend.
 */
export function MiniPlayer({ className, docked = false }: { className?: string; docked?: boolean }) {
  const player = usePlayer()
  const { t } = useI18n()
  const { request, preview, status, progress } = player
  const visible = !!request

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="player"
          role="region"
          aria-label={t.player.region}
          initial={docked ? { opacity: 0, height: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          animate={docked ? { opacity: 1, height: 'auto' } : { opacity: 1, y: 0, scale: 1 }}
          exit={docked ? { opacity: 0, height: 0 } : { opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className={className}
        >
          <div
            className={cn(
              'pointer-events-auto relative flex items-center gap-3 overflow-hidden p-2 pr-2.5',
              docked ? 'w-full border-t border-white/[0.07] px-4 py-3' : 'glass w-[min(360px,calc(100vw-24px))] rounded-2xl',
            )}
          >
            <CoverImage src={preview?.cover} className="relative size-11 shrink-0 rounded-lg ring-1 ring-white/10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-hi">
                {status === 'error' ? t.player.noPreview : (preview?.title ?? t.player.finding)}
              </p>
              <p className="truncate text-[12px] text-mid">{preview?.artist ?? request.label}</p>
            </div>
            {preview?.link && (
              <a
                href={preview.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.player.openDeezer}
                title={t.player.openDeezer}
                className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
              >
                <ArrowUpRight />
              </a>
            )}
            <button
              type="button"
              onClick={player.toggle}
              disabled={!preview || status === 'error'}
              aria-label={status === 'playing' ? t.common.pause : t.common.play}
              className="grid size-9 place-items-center rounded-full bg-accent text-on-accent transition active:scale-95 disabled:opacity-40 [&_svg]:size-4"
            >
              {status === 'playing' ? <Pause fill="currentColor" /> : <Play className="translate-x-px" fill="currentColor" />}
            </button>
            <button
              type="button"
              onClick={player.stop}
              aria-label={t.player.close}
              className="grid size-8 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi [&_svg]:size-4"
            >
              <X />
            </button>
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.06]">
              <div className="h-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
