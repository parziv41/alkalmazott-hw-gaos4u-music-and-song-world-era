import { Earth, Gamepad2, History, Info, Search, Shuffle } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type Ref } from 'react'
import { isMac } from '../../utils/misc'
import { useI18n } from '../../i18n/context'
import { BrandMark } from '../UI/BrandMark'
import { IconButton } from '../UI/IconButton'
import { Kbd } from '../UI/Kbd'

type TopBarProps = {
  onSearch: () => void
  onGlobalChart: () => void
  onTimeMachine: () => void
  timeMachineOpen: boolean
  onQuiz: () => void
  quizOpen: boolean
  onSurprise: () => void
  onAbout: () => void
  searchRef?: Ref<HTMLButtonElement>
}

export function TopBar({ onSearch, onGlobalChart, onTimeMachine, timeMachineOpen, onQuiz, quizOpen, onSurprise, onAbout, searchRef }: TopBarProps) {
  const [spins, setSpins] = useState(0)
  const { t, lang, setLang } = useI18n()

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="absolute inset-x-0 top-0 flex items-center gap-1.5 p-3 sm:gap-2 md:gap-3 md:p-4"
    >
      <a
        href="/"
        className="pointer-events-auto flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 outline-none sm:pr-3 focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={t.topBar.home}
      >
        <BrandMark className="size-9 drop-shadow-[0_4px_14px_rgb(0_0_0/0.5)]" />
        <span className="hidden text-[17px] leading-none tracking-tight sm:block">
          <span className="font-display text-[22px] italic">Global</span> <span className="font-medium">Music Mapper</span>
        </span>
      </a>

      <button
        ref={searchRef}
        type="button"
        onClick={onSearch}
        aria-label={t.topBar.search}
        className="glass pointer-events-auto ml-auto inline-flex h-9 shrink-0 items-center gap-2.5 rounded-full px-2.5 text-[13px] sm:h-10 sm:px-3 text-mid transition hover:bg-white/10 hover:text-hi md:ml-2 md:w-72 md:px-4"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left md:block">{t.topBar.searchShort}</span>
        <span className="hidden md:contents">
          <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
        </span>
      </button>

      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 md:ml-auto">
        <button
          type="button"
          onClick={onGlobalChart}
          aria-label={t.topBar.top100}
          title={t.topBar.top100}
          className="glass inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-[13px] font-medium sm:h-10 sm:px-3 text-mid transition hover:bg-white/10 hover:text-hi active:scale-95 [&_svg]:size-[18px] md:px-4"
        >
          <Earth />
          <span className="hidden lg:inline">{t.topBar.top100Short}</span>
        </button>
        <IconButton compact label={t.topBar.timeMachine} aria-pressed={timeMachineOpen} onClick={onTimeMachine} className={timeMachineOpen ? 'text-accent' : undefined}>
          <History />
        </IconButton>
        <IconButton compact label={t.topBar.quiz} aria-pressed={quizOpen} onClick={onQuiz} className={quizOpen ? 'text-accent' : undefined}>
          <Gamepad2 />
        </IconButton>
        <IconButton
          compact
          label={t.topBar.surprise}
          onClick={() => {
            setSpins((count) => count + 1)
            onSurprise()
          }}
        >
          <motion.span animate={{ rotate: spins * 360 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }} className="grid">
            <Shuffle />
          </motion.span>
        </IconButton>
        <IconButton compact label={t.topBar.about} onClick={onAbout}>
          <Info />
        </IconButton>
        <button
          type="button"
          onClick={() => setLang(lang === 'hu' ? 'en' : 'hu')}
          aria-label={t.language.switch}
          title={t.language.switch}
          lang={lang === 'hu' ? 'en' : 'hu'}
          className="glass grid size-9 shrink-0 place-items-center rounded-full font-mono sm:size-10 text-[12px] font-medium text-mid transition hover:bg-white/10 hover:text-hi active:scale-95"
        >
          {lang === 'hu' ? 'EN' : 'HU'}
        </button>
      </div>
    </motion.header>
  )
}
