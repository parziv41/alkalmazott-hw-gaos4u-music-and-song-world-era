import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { allGenres, countries, curatedCountries } from '../../data'
import { useI18n } from '../../i18n/context'
import { isMac } from '../../utils/misc'
import { BrandMark } from '../UI/BrandMark'
import { IconButton } from '../UI/IconButton'
import { Kbd } from '../UI/Kbd'

/** Native <dialog>: focus trapping, Esc and the backdrop come from the browser. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()
  const shortcuts: [string[], string][] = [
    [[isMac ? '⌘' : 'Ctrl', 'K'], t.about.keys.search],
    [['/'], t.about.keys.slash],
    [['←', '→'], t.about.keys.arrows],
    [['Esc'], t.about.keys.escape],
    [['?'], t.about.keys.help],
  ]

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      aria-labelledby="about-title"
      className="about-dialog glass m-auto w-[min(560px,calc(100vw-32px))] rounded-3xl p-0 text-hi"
    >
      <div className="relative max-h-[85dvh] overflow-y-auto p-6 md:p-8">
        <IconButton label={t.common.close} variant="ghost" onClick={onClose} className="absolute right-4 top-4">
          <X />
        </IconButton>
        <BrandMark className="size-11" />
        <h2 id="about-title" className="mt-4 font-display text-[36px] leading-10">
          {t.about.title}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-mid">{t.about.intro(countries.length, curatedCountries.length, allGenres.length)}</p>

        <h3 className="label-mono mt-7">{t.about.shortcuts}</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[14px]">
          {shortcuts.map(([keys, description]) => (
            <div key={description} className="contents">
              <dt className="flex gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dt>
              <dd className="text-mid">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13px] text-lo">{t.about.gestures}</p>

        <h3 className="label-mono mt-7">{t.about.credits}</h3>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-5 text-mid">
          {t.about.creditList.map((credit, index) => (
            <li key={index}>{credit}</li>
          ))}
          <li className="text-lo">{t.about.discogsNotice}</li>
        </ul>
      </div>
    </dialog>
  )
}
