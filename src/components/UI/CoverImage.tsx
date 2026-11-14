import { Disc3 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../utils/misc'

type CoverImageProps = { src?: string; className?: string }

/**
 * Album cover that fades and un-blurs in once loaded, with a generated sleeve when Discogs has no image.
 * Position and size it through `className` (e.g. `absolute size-[88px]`).
 */
export function CoverImage({ src, className }: CoverImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={cn(
        'overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--accent)_45%,#141b30),#0d1222)]',
        className,
      )}
    >
      {(!src || failed) && (
        <div className="absolute inset-0 grid place-items-center text-on-accent/60">
          <Disc3 className="size-8" strokeWidth={1.5} />
        </div>
      )}
      {src && !failed && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          ref={(img) => {
            // Cached images can finish loading before React attaches onLoad.
            if (img?.complete && img.naturalWidth > 0) setLoaded(true)
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'size-full object-cover transition-[opacity,filter,scale] duration-500 ease-out-soft',
            loaded ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-md',
          )}
        />
      )}
    </div>
  )
}
