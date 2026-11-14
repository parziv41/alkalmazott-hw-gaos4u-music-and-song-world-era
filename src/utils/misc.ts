import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export const DEFAULT_HUE = 275

export function accentColor(hue: number): string {
  return `oklch(0.8 0.14 ${hue})`
}

/** Re-tints the whole UI; the registered --accent properties animate the change in CSS. */
export function setAccentHue(hue: number): void {
  document.documentElement.style.setProperty('--hue', String(hue))
}

export function pickRandom<T>(items: readonly T[], exclude?: T): T {
  const pool = items.length > 1 && exclude !== undefined ? items.filter((item) => item !== exclude) : items
  return pool[Math.floor(Math.random() * pool.length)]
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

// localStorage can be missing or throw (private mode, blocked storage); the app works without it.
export function safeLocalStorage(): Storage | undefined {
  try {
    const storage = window.localStorage
    storage.setItem('__gmm', '1')
    storage.removeItem('__gmm')
    return storage
  } catch {
    return undefined
  }
}

export function readFlag(key: string): boolean {
  return safeLocalStorage()?.getItem(key) === '1'
}

export function readNumber(key: string): number {
  return Number(safeLocalStorage()?.getItem(key)) || 0
}

export function writeNumber(key: string, value: number): void {
  try {
    safeLocalStorage()?.setItem(key, String(value))
  } catch {
    // Storage full or blocked: the best score just isn't kept.
  }
}

export function clearFlag(key: string): void {
  try {
    safeLocalStorage()?.removeItem(key)
  } catch {
    // Blocked storage: the setting just won't be remembered.
  }
}

export function writeFlag(key: string): void {
  try {
    safeLocalStorage()?.setItem(key, '1')
  } catch {
    // Storage full or blocked: forgetting the flag is harmless.
  }
}
