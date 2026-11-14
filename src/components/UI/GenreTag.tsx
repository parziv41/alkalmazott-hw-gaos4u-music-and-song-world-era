import { motion } from 'motion/react'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '../../utils/misc'

type GenreTagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean
  ref?: Ref<HTMLButtonElement>
}

/** Pill-shaped radio button; the selected background glides between pills via a shared layoutId. */
export function GenreTag({ selected, className, children, ...props }: GenreTagProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        'relative isolate rounded-full px-3.5 py-1.5 text-[13px] font-medium leading-5 outline-none transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
        selected ? 'text-on-accent' : 'bg-white/[0.05] text-hi ring-1 ring-white/10 hover:bg-white/10',
        className,
      )}
      {...props}
    >
      {selected && (
        <motion.span
          layoutId="genre-pill"
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-accent shadow-[0_6px_20px_-6px_var(--accent)]"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
      {children}
    </button>
  )
}
