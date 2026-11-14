// The same song on different charts: Apple writes "CIA", Shazam "CIA (feat. …)", one credits
// "KAROL G, Judeline & rusowsky", the other "KAROL G". Must match api/charts.ts' songKey exactly.

/** Lowercase letters and digits only, accents removed. */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')

/** "KAROL G, Judeline & rusowsky" → "KAROL G" */
export const leadArtist = (artist: string) => artist.split(/,|&|\s+(?:feat\.?|ft\.?|x|and|with)\s+/i)[0].trim()

export const songKey = (artist: string, title: string) => `${normalize(leadArtist(artist))}|${normalize(title.replace(/\s*[([].*?[)\]]/g, ''))}`
