import { animate, motion, useDragControls, useMotionValue, type PanInfo } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useViewportHeight } from '../../hooks/dom'
import { SHEET_FULL, SHEET_PEEK } from '../../utils/layout'
import { useI18n } from '../../i18n/context'
import { MiniPlayer } from '../Layout/MiniPlayer'

type Snap = 'peek' | 'full'
const SPRING = { type: 'spring', stiffness: 420, damping: 42 } as const
// How far ahead (in seconds of velocity) a flick is projected when choosing where to snap.
const FLICK_PROJECTION = 0.2

/** Desktop: a floating glass panel on the right, with the preview player docked at its foot. */
export function PanelFrame({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <motion.aside
      aria-labelledby={labelledBy}
      initial={{ opacity: 0, x: 56 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 56, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="glass-panel fixed bottom-3 right-3 top-3 z-30 flex w-(--panel-w) flex-col overflow-hidden rounded-3xl"
    >
      {children}
      <MiniPlayer docked className="shrink-0" />
    </motion.aside>
  )
}

/**
 * Mobile: a bottom sheet that rests at peek height, drags up to full height, and drags down to
 * close. Its content is told when it is at peek, where the sheet moves instead of the content scrolling.
 */
export function SheetFrame({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string
  onClose: () => void
  children: (scrollLocked: boolean) => ReactNode
}) {
  const viewportHeight = useViewportHeight()
  const { t } = useI18n()
  const sheetHeight = viewportHeight * SHEET_FULL
  const offsets = { full: 0, peek: sheetHeight - viewportHeight * SHEET_PEEK, closed: sheetHeight }
  const [snap, setSnap] = useState<Snap>('peek')
  const y = useMotionValue(offsets.closed)
  const dragControls = useDragControls()

  const target = offsets[snap]
  useEffect(() => {
    const controls = animate(y, target, SPRING)
    return () => controls.stop()
  }, [y, target])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const projected = y.get() + info.velocity.y * FLICK_PROJECTION
    const nearest = (['full', 'peek', 'closed'] as const).reduce((best, key) =>
      Math.abs(offsets[key] - projected) < Math.abs(offsets[best] - projected) ? key : best,
    )
    if (nearest === 'closed') return onClose()
    if (nearest === snap) animate(y, offsets[snap], SPRING)
    else setSnap(nearest)
  }

  return (
    <motion.aside
      aria-labelledby={labelledBy}
      className="glass-panel fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl border-b-0"
      style={{ height: sheetHeight, y }}
      drag="y"
      dragControls={dragControls}
      // At peek the whole sheet drags; at full height only the handle does, so content can scroll.
      dragListener={snap !== 'full'}
      dragConstraints={{ top: 0, bottom: offsets.closed }}
      dragElastic={{ top: 0.04, bottom: 0.3 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      exit={{ y: offsets.closed, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
    >
      <div className="flex shrink-0 touch-none justify-center pb-1 pt-2.5" onPointerDown={(event) => dragControls.start(event)}>
        <button
          type="button"
          aria-label={snap === 'full' ? t.panel.collapse : t.panel.expand}
          onClick={() => setSnap((current) => (current === 'full' ? 'peek' : 'full'))}
          className="h-1.5 w-11 rounded-full bg-white/25 transition hover:bg-white/40"
        />
      </div>
      {children(snap !== 'full')}
    </motion.aside>
  )
}
