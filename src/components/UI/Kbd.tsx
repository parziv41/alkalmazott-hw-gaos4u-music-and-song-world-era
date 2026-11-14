import type { ReactNode } from 'react'
import { cn } from '../../utils/misc'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5',
        'font-mono text-[10.5px] leading-none text-mid',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
