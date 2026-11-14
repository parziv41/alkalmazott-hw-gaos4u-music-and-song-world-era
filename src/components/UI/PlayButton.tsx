import { LoaderCircle, Pause, Play } from 'lucide-react'
import { usePlayer, type PreviewRequest } from '../../hooks/usePlayer'
import { useI18n } from '../../i18n/context'
import { cn } from '../../utils/misc'

/** Plays a 30-second preview; shows loading, playing (equaliser) and paused states for its own row. */
export function PlayButton({ request, className }: { request: PreviewRequest; className?: string }) {
  const player = usePlayer()
  const { t } = useI18n()
  const mine = player.request?.key === request.key
  const status = mine ? player.status : 'idle'
  const playing = status === 'playing'

  return (
    <button
      type="button"
      aria-label={playing ? t.player.pauseLabel(request.label) : t.player.playLabel(request.label)}
      aria-pressed={playing}
      title={status === 'error' ? t.player.noPreviewTitle : playing ? t.common.pause : t.player.playTitle}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (mine && (status === 'playing' || status === 'paused')) player.toggle()
        else player.play(request)
      }}
      className={cn(
        'group/play relative grid size-9 shrink-0 place-items-center rounded-full transition duration-150 active:scale-95 [&_svg]:size-4',
        playing ? 'bg-accent text-on-accent shadow-[0_6px_18px_-6px_var(--accent)]' : 'bg-white/[0.06] text-hi ring-1 ring-white/10 hover:bg-white/12',
        status === 'error' && 'text-lo ring-red-400/30',
        className,
      )}
    >
      {status === 'loading' ? (
        <LoaderCircle className="animate-spin" />
      ) : playing ? (
        <>
          <span aria-hidden className="eq group-hover/play:hidden">
            <i />
            <i />
            <i />
          </span>
          <Pause className="hidden group-hover/play:block" fill="currentColor" />
        </>
      ) : (
        <Play className="translate-x-px" fill="currentColor" />
      )}
    </button>
  )
}
