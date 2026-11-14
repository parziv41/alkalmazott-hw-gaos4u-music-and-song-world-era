import { useQueryClient } from '@tanstack/react-query'
import { LayoutGroup } from 'motion/react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { prefetchReleases } from '../../hooks/useReleases'
import { useI18n } from '../../i18n/context'
import type { Country, Genre } from '../../types/music'
import { GenreTag } from '../UI/GenreTag'

const INTENT_DELAY_MS = 120

type GenreSelectorProps = { country: Country; genre: Genre; onSelect: (genre: Genre) => void }

/** Radio group of genre pills: arrow keys move the selection, and hovering one prefetches its records. */
export function GenreSelector({ country, genre, onSelect }: GenreSelectorProps) {
  const queryClient = useQueryClient()
  const { t, countryName } = useI18n()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const intentTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(intentTimer.current), [])

  const prefetch = (target: Genre) => prefetchReleases(queryClient, country, target)
  const startIntent = (target: Genre) => {
    window.clearTimeout(intentTimer.current)
    intentTimer.current = window.setTimeout(() => prefetch(target), INTENT_DELAY_MS)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const count = country.genres.length
    const index = (country.genres.indexOf(genre) + step + count) % count
    onSelect(country.genres[index])
    buttons.current[index]?.focus()
  }

  return (
    <LayoutGroup id={`genres-${country.id}`}>
      <div role="radiogroup" aria-label={t.sounds.genresOf(countryName(country))} className="flex flex-wrap gap-2" onKeyDown={handleKeyDown}>
        {country.genres.map((item, index) => (
          <GenreTag
            key={item.id}
            ref={(element) => {
              buttons.current[index] = element
            }}
            selected={item.id === genre.id}
            tabIndex={item.id === genre.id ? 0 : -1}
            onClick={() => onSelect(item)}
            onPointerEnter={() => startIntent(item)}
            onPointerLeave={() => window.clearTimeout(intentTimer.current)}
            onFocus={() => prefetch(item)}
          >
            {item.name}
          </GenreTag>
        ))}
      </div>
    </LayoutGroup>
  )
}
