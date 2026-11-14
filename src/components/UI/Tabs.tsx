import { motion } from 'motion/react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../utils/misc'

export type TabItem<T extends string> = { id: T; label: string; icon?: ReactNode; count?: number }

/** Segmented control (ARIA tabs); the selected background glides between tabs. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  idPrefix: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const index = (items.findIndex((item) => item.id === value) + step + items.length) % items.length
    onChange(items[index].id)
    refs.current[index]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 rounded-2xl bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-controls={`${idPrefix}-panel`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative isolate flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12.5px] font-medium outline-none transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0',
              'focus-visible:ring-2 focus-visible:ring-accent',
              selected ? 'text-hi' : 'text-mid hover:text-hi',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${idPrefix}-tab-bg`}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-xl bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            {/* Icons only where four tabs have room for them. */}
            {item.icon && <span className="hidden sm:contents">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
