import { cn } from '../../utils/misc'

/** A spinning record: the loading indicator. Size it with a `size-*` class. */
export function VinylLoader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('animate-spin [animation-duration:1.8s]', className)}>
      <circle cx="16" cy="16" r="15" fill="#0d0e13" stroke="rgb(255 255 255 / 0.1)" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="rgb(255 255 255 / 0.06)" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="rgb(255 255 255 / 0.06)" />
      <path d="M6 9.5A12 12 0 0 1 12.5 4.5" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="5.5" fill="var(--accent)" />
      <circle cx="16" cy="16" r="1.2" fill="#0d0e13" />
    </svg>
  )
}
