import { cn } from '../../utils/misc'

/** A record whose label is a globe. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <circle cx="16" cy="16" r="15" fill="#0d1020" stroke="rgb(255 255 255 / 0.14)" />
      <circle cx="16" cy="16" r="12.2" fill="none" stroke="rgb(255 255 255 / 0.07)" />
      <circle cx="16" cy="16" r="9.8" fill="none" stroke="rgb(255 255 255 / 0.07)" />
      <path d="M5.2 10.4A12.4 12.4 0 0 1 11 4.6" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="6.6" fill="var(--accent)" />
      <g fill="none" stroke="#0a0f1e" strokeOpacity="0.55" strokeWidth="0.8">
        <ellipse cx="16" cy="16" rx="2.7" ry="6.6" />
        <path d="M9.4 16h13.2M10.3 12.8h11.4M10.3 19.2h11.4" />
      </g>
      <circle cx="16" cy="16" r="1" fill="#0a0f1e" />
    </svg>
  )
}
