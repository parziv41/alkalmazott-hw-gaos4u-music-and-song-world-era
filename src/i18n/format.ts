// Hungarian number words decide the suffix: hatvan → 1960-as, hetven → 1970-es, kétezer → 2000-es.

const DECADE_SUFFIX: Record<string, 'as' | 'es'> = { '1': 'es', '2': 'as', '3': 'as', '4': 'es', '5': 'es', '6': 'as', '7': 'es', '8': 'as', '9': 'es' }

/** "1960-as", "1970-es", "1900-as", "2000-es". */
export function huDecade(decade: number): string {
  const tens = String(decade).at(-2) ?? '0'
  const suffix = tens !== '0' ? DECADE_SUFFIX[tens] : decade >= 2000 ? 'es' : 'as'
  return `${decade}-${suffix}`
}

/** "a" or "az" before a number, as it is read aloud: az 1970-es, a 2000-es, az 5. */
export function huArticle(value: number | string): 'a' | 'az' {
  return /^(1|5)/.test(String(value)) ? 'az' : 'a'
}
