import { cn } from '../../utils/misc'
import { flagFor } from './flags'

export function Flag({ iso2, className }: { iso2: string; className?: string }) {
  const url = flagFor(iso2)
  if (!url) return <span aria-hidden className={cn('inline-block bg-white/10', className)} />
  return <img src={url} alt="" aria-hidden draggable={false} decoding="async" className={cn('block shrink-0 object-cover', className)} />
}
