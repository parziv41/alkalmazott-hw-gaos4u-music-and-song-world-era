import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '../../utils/misc'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  variant?: 'glass' | 'ghost'
  /** A little smaller on phones, where the top bar is crowded. */
  compact?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ label, variant = 'glass', compact = false, className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full text-mid transition duration-150',
        compact ? 'size-9 sm:size-10' : 'size-10',
        'hover:text-hi active:scale-95 [&_svg]:size-[18px]',
        variant === 'glass' ? 'glass hover:bg-white/10' : 'hover:bg-white/8',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
