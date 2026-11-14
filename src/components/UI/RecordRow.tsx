import { ArrowUpRight } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import type { Release } from '../../types/music'
import { CoverImage } from './CoverImage'

const recordRowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } },
}

/**
 * One release: on hover or focus, the record slides out of its sleeve and spins
 * while the cover's colours glow behind the row.
 */
export function RecordRow({ release, rank }: { release: Release; rank: number }) {
  const meta = [release.year, release.label, release.format].filter(Boolean).join(' · ')

  return (
    <motion.li variants={recordRowVariants}>
      <a
        href={release.discogsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative isolate -mx-2.5 grid grid-cols-[136px_1fr] items-center gap-3.5 overflow-hidden rounded-2xl p-2.5 outline-none transition-colors duration-200 hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-accent"
      >
        {release.coverUrl && (
          <img
            aria-hidden
            src={release.coverUrl}
            alt=""
            loading="lazy"
            className="pointer-events-none absolute inset-0 -z-10 size-full scale-125 object-cover opacity-0 blur-2xl saturate-150 transition-opacity duration-500 group-hover:opacity-25 group-focus-visible:opacity-25"
          />
        )}

        <div className="relative h-[88px] w-[136px]">
          <div className="vinyl absolute left-[2px] top-[2px] size-[84px] translate-x-[22px] transition-transform duration-700 ease-out-soft group-hover:translate-x-[48px] group-hover:rotate-180 group-focus-visible:translate-x-[48px] group-focus-visible:rotate-180" />
          <CoverImage
            src={release.coverUrl}
            className="absolute left-0 top-0 size-[88px] rounded-md shadow-[0_10px_24px_-6px_rgb(0_0_0/0.7)] ring-1 ring-white/10"
          />
        </div>

        <div className="min-w-0">
          <p className="font-mono text-[10.5px] tracking-[0.18em] text-lo">{String(rank).padStart(2, '0')}</p>
          <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-5 text-hi">{release.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-mid">{release.artist}</p>
          <p className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-lo">
            <span className="truncate">{meta}</span>
            <ArrowUpRight
              aria-hidden
              className="size-3.5 shrink-0 -translate-x-1 text-accent opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            />
          </p>
        </div>
      </a>
    </motion.li>
  )
}

export function RecordRowSkeleton() {
  return (
    <li className="grid grid-cols-[136px_1fr] items-center gap-3.5 py-2.5" aria-hidden>
      <div className="skeleton size-[88px] rounded-md" />
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-6 rounded-full" />
        <div className="skeleton h-3.5 w-4/5 rounded-full" />
        <div className="skeleton h-3 w-1/2 rounded-full" />
        <div className="skeleton h-2.5 w-2/5 rounded-full" />
      </div>
    </li>
  )
}
