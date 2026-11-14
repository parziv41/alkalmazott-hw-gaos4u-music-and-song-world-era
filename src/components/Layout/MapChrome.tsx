import { Clapperboard, Globe, Minus, Moon, Music2, Plus, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { countries, curatedCountries } from '../../data'
import type { Layers } from '../../utils/cityClusters'
import { useI18n } from '../../i18n/context'
import { cn, isMac } from '../../utils/misc'
import { Kbd } from '../UI/Kbd'

const cityTotal = countries.reduce((sum, country) => sum + country.cityCount, 0)

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.7, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const },
}

type LegendProps = { layers: Layers; onLayers: (layers: Layers) => void; showLayers: boolean }

export function Legend({ layers, onLayers, showLayers }: LegendProps) {
  const { t, number } = useI18n()
  const toggles = [
    { id: 'music' as const, label: t.chrome.music, icon: <Music2 /> },
    { id: 'films' as const, label: t.chrome.films, icon: <Clapperboard /> },
  ]
  return (
    <motion.div {...fadeUp} className="absolute bottom-4 left-4 hidden md:block">
      <AnimatePresence>
        {showLayers && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            role="group"
            aria-label={t.chrome.showOnGlobe}
            className="glass pointer-events-auto mb-3 inline-flex gap-1 rounded-full p-1"
          >
            {toggles.map((toggle) => {
              const on = layers[toggle.id]
              return (
                <button
                  key={toggle.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    // At least one layer stays on, or the globe would have no cities to show.
                    const other = toggle.id === 'music' ? 'films' : 'music'
                    if (!on || layers[other]) onLayers({ ...layers, [toggle.id]: !on })
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition [&_svg]:size-3.5',
                    on ? 'bg-white/[0.1] text-hi' : 'text-lo hover:text-mid',
                  )}
                >
                  {toggle.icon}
                  {toggle.label}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="flex items-center gap-2 text-[12px] text-mid">
        <span className="size-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
        {t.chrome.summary(countries.length, number(cityTotal), curatedCountries.length)}
      </p>
      <p className="pointer-events-auto mt-1 text-[11px] text-lo">
        {t.chrome.data}:{' '}
        <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer" className="hover:text-mid">
          Wikidata
        </a>
        ,{' '}
        <a href="https://www.shazam.com/charts" target="_blank" rel="noopener noreferrer" className="hover:text-mid">
          Shazam
        </a>
        , Apple Music, Deezer,{' '}
        <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" className="hover:text-mid">
          GeoNames
        </a>
        ,{' '}
        <a href="https://www.discogs.com" target="_blank" rel="noopener noreferrer" className="hover:text-mid">
          Discogs
        </a>{' '}
        · {t.chrome.map}:{' '}
        <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener noreferrer" className="hover:text-mid">
          Natural Earth
        </a>
        ,{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-mid">
          © OpenStreetMap
        </a>
      </p>
    </motion.div>
  )
}

type MapControlsProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  night: boolean
  onToggleNight: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onReset, night, onToggleNight }: MapControlsProps) {
  const { t } = useI18n()
  const buttonClass =
    'grid size-10 place-items-center text-mid transition hover:bg-white/10 hover:text-hi active:scale-95 [&_svg]:size-[18px]'
  return (
    <motion.div
      {...fadeUp}
      role="group"
      aria-label={t.chrome.zoom}
      className="glass pointer-events-auto absolute bottom-4 right-4 hidden flex-col overflow-hidden rounded-2xl md:flex"
    >
      <button type="button" aria-label={t.chrome.zoomIn} title={t.chrome.zoomIn} onClick={onZoomIn} className={buttonClass}>
        <Plus />
      </button>
      <div className="mx-2 h-px bg-white/[0.07]" />
      <button type="button" aria-label={t.chrome.zoomOut} title={t.chrome.zoomOut} onClick={onZoomOut} className={buttonClass}>
        <Minus />
      </button>
      <div className="mx-2 h-px bg-white/[0.07]" />
      <button type="button" aria-label={t.chrome.reset} title={t.chrome.reset} onClick={onReset} className={buttonClass}>
        <Globe />
      </button>
      <div className="mx-2 h-px bg-white/[0.07]" />
      <button
        type="button"
        aria-label={t.chrome.dayNight}
        aria-pressed={night}
        title={night ? t.chrome.hideDayNight : t.chrome.dayNight}
        onClick={onToggleNight}
        className={cn(buttonClass, night && 'text-accent')}
      >
        <Moon />
      </button>
    </motion.div>
  )
}

export function OnboardingHint({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { t } = useI18n()
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 1.5, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.2 } }}
          className="absolute inset-x-0 bottom-6 flex justify-center px-4 md:bottom-5"
        >
          <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-full py-1.5 pl-4 pr-1.5 text-[13px] text-mid">
            <Sparkles className="size-4 shrink-0 text-accent" />
            <span>
              {t.chrome.hint}
              <span className="hidden md:inline">{t.chrome.hintSearch(<Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>)}</span>
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t.chrome.dismissHint}
              className="grid size-7 place-items-center rounded-full text-lo transition hover:bg-white/10 hover:text-hi"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
