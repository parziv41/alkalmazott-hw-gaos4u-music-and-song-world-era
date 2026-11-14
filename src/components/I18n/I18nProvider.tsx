import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createI18n, I18nContext, type CuratedTranslation, type Lang } from '../../i18n/context'
import { safeLocalStorage } from '../../utils/misc'

const STORAGE_KEY = 'gmm:lang'

/** The saved choice, else the browser's language: Hungarian browsers start in Hungarian. */
function initialLang(): Lang {
  const saved = safeLocalStorage()?.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'hu') return saved
  const languages = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  return languages.some((language) => language?.toLowerCase().startsWith('hu')) ? 'hu' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [curated, setCurated] = useState<CuratedTranslation | null>(null)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      safeLocalStorage()?.setItem(STORAGE_KEY, next)
    } catch {
      // The choice just won't be remembered.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    // The curated texts in Hungarian (~40 KB) load only for Hungarian readers.
    if (lang === 'hu' && !curated) {
      void import('../../data/countries.hu.json').then((module) => setCurated(module.default as CuratedTranslation))
    }
  }, [lang, curated])

  const value = useMemo(() => createI18n(lang, setLang, curated), [lang, setLang, curated])
  return <I18nContext value={value}>{children}</I18nContext>
}
