// Reads the chart tables of Wikipedia's "List of number-one singles" pages. The page's wikitext tables
// become simple HTML tables (wikitextTables), which are read as a grid with rowspan and colspan
// expanded (grid, chartRows). No DOM or MediaWiki needed.

export type Cell = { id: number; text: string; header: boolean }

/** One song in one row of a chart table. `entry` is the same for every row a spanned song cell covers. */
export type ChartRow = { year?: number; title: string; artist: string; weeks?: number; note?: string; entry: number }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' }

export function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

/** A cell's visible text: no footnotes, hidden sort keys or styles. */
export function cellText(html: string): string {
  return decode(
    html
      .replace(/<sup\b[\s\S]*?<\/sup>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<span\b[^>]*display:\s*none[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

let nextId = 0

/** The table as rows of cells, with spanned cells repeated (the same object) in every row and column they cover. */
export function grid(table: string): Cell[][] {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(([, kind, attributes, content]) => ({
      cell: { id: nextId++, text: cellText(content), header: kind.toLowerCase() === 'th' },
      rows: Math.max(1, Number(/rowspan\s*=\s*["']?\s*(\d+)/i.exec(attributes)?.[1] ?? 1)),
      cols: Math.min(20, Math.max(1, Number(/colspan\s*=\s*["']?\s*(\d+)/i.exec(attributes)?.[1] ?? 1))),
    })),
  )
  const carried: ({ cell: Cell; left: number } | undefined)[] = []
  return rows.map((cells) => {
    const line: Cell[] = []
    let column = 0
    let next = 0
    const pending = () => carried.some((carry, index) => index >= column && carry && carry.left > 0)
    while (next < cells.length || pending()) {
      const carry = carried[column]
      if (carry && carry.left > 0) {
        line[column++] = carry.cell
        carry.left--
        continue
      }
      if (next >= cells.length) {
        column++
        continue
      }
      const { cell, rows: span, cols } = cells[next++]
      for (let k = 0; k < cols; k++) {
        line[column + k] = cell
        carried[column + k] = span > 1 ? { cell, left: span - 1 } : undefined
      }
      column += cols
    }
    return line
  })
}

// Header names; (?!\p{L}) instead of \b, which doesn't see the end of "Előadó".
const SONG = /^(song|songs|single|singles|title|track|song title|single title|a-side|dal|dal címe|cím)(?!\p{L})/iu
const ARTIST = /^(artist|artists|artist\(s\)|performer|performers|performer\(s\)|act|előadó|előadók)(?!\p{L})/iu
const DATE = /\b(date|week|weeks? (ending|of|starting)|chart week|reached number one|issue)\b/i
const WEEKS = /^(weeks|wks)\b|weeks at (no|number)/i
const PRIZE = /^(díj|prize|award|helyezés)(?!\p{L})/iu
// Billboard before the Hot 100: one column per chart, each cell "Song" with the artist below it.
const COMBINED = /^(best[- ]sell(ers|ing)\b.*(store|retail)|best sellers in stores)/i
const yearIn = (text: string | undefined) => {
  const match = text && /\b(1[89]\d\d|20\d\d)\b/.exec(text)
  return match ? Number(match[1]) : undefined
}

export const cleanTitle = (text: string) =>
  text
    .replace(/["“”„″]/g, '')
    .replace(/[†‡§¶*#◆♦]+/g, '')
    .replace(/\s*\((re|re-entry)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

export const cleanArtist = (text: string) =>
  text
    .replace(/[†‡§¶*#◆♦]+/g, '')
    // Some lists quote the artist like the title ("The Beatles"); quotes inside a name (Nat "King" Cole) stay.
    .replace(/^\s*["“”„]+|["“”„]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The songs in a chart table. A table needs a song and an artist column (several pairs are read, for
 * tables that list two songs per row); its year comes from the row's date, a year row ("1965" across
 * the table), or the page's year.
 */
export function chartRows(table: string, pageYear?: number): ChartRow[] {
  const cells = grid(table)
  const headerIndex = cells.findIndex((row) => row.length >= 2 && row.every((cell) => cell.header))
  if (headerIndex < 0) return []
  const header = cells[headerIndex].map((cell) => cell.text)
  const all = (pattern: RegExp) => header.flatMap((name, index) => (pattern.test(name) ? [index] : []))
  const songs = all(SONG)
  const artists = all(ARTIST)
  const combined = header.findIndex((name) => COMBINED.test(name))
  if ((!songs.length || !artists.length) && combined < 0) return []
  const date = header.findIndex((name) => DATE.test(name) && !WEEKS.test(name))
  const weeks = header.findIndex((name) => WEEKS.test(name))
  const prize = header.findIndex((name) => PRIZE.test(name))
  // A combined column has no artist column (-1): the artist follows the quoted title in the same cell.
  const pairs: (readonly [number, number])[] =
    songs.length && artists.length ? songs.slice(0, artists.length).map((song, index) => [song, artists[index]] as const) : [[combined, -1]]

  const out: ChartRow[] = []
  let sectionYear: number | undefined
  for (const row of cells.slice(headerIndex + 1)) {
    // A row spanning the whole table, like "1965", starts that year.
    if (row.length > 0 && row.every((cell) => cell === row[0])) {
      sectionYear = yearIn(row[0].text) ?? sectionYear
      continue
    }
    if (row.every((cell) => cell.header)) continue
    const year = yearIn(date < 0 ? undefined : row[date]?.text) ?? sectionYear ?? pageYear
    for (const [songColumn, artistColumn] of pairs) {
      const song = row[songColumn]
      const artist = artistColumn < 0 ? undefined : row[artistColumn]
      // '"Teddy Bear" / "Loving You" Elvis Presley': one or more quoted titles, then the artist.
      const both = artistColumn < 0 && song ? /^((?:["“][^"”]+["”]\s*\/?\s*)+)(.+)$/.exec(song.text) : null
      if (!song || (!artist && !both)) continue
      const title = cleanTitle(both ? both[1].replace(/["”]\s*\/\s*["“]/g, ' / ') : song.text)
      const name = cleanArtist(both ? both[2] : (artist?.text ?? ''))
      if (!title || !name || title === name || /^(n\/a|—|-|–)$/i.test(title)) continue
      const weekCount = weeks >= 0 ? Number.parseInt(row[weeks]?.text ?? '', 10) : Number.NaN
      out.push({
        year,
        title,
        artist: name,
        weeks: Number.isFinite(weekCount) ? weekCount : undefined,
        note: prize >= 0 ? row[prize]?.text || undefined : undefined,
        entry: song.id,
      })
    }
  }
  return out
}

/** The years a page title covers: "of 1965", "of the 1960s", "’66". */
export function titleYears(title: string): number[] {
  const decade = /\b(1[89]\d0|20\d0)s\b/.exec(title)
  if (decade) return Array.from({ length: 10 }, (_, i) => Number(decade[1]) + i)
  const range = /\b(1[89]\d\d|20\d\d)\s*(?:[–-]|\bto\b)\s*(1[89]\d\d|20\d\d)\b/.exec(title)
  if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i)
  const year = /\b(1[89]\d\d|20\d\d)\b/.exec(title)
  if (year) return [Number(year[1])]
  const short = /[’'](\d\d)\b/.exec(title)
  return short ? [1900 + Number(short[1])] : []
}

// ── Wikitext ───────────────────────────────────────────────────────────────────
// Wikipedia's API returns the source of 50 pages per request, where rendered HTML takes one request a
// page. These turn a page's wikitext tables into the same simple HTML tables, so chartRows reads both.

// Footnotes, flags, anchors and the like: nothing a reader would call the title or the artist.
const DROPPED =
  /^(#tag:ref|efn|efn-[a-z]+|refn|ref|r|rp|sfn|sfnp|harvnb|cite[\w ]*|citation|anchor|flagicon|flag icon|flagdeco|flagcountry|dagger|double-dagger|cn|citation needed|clarify|when|update|as of|note|ref label|note label|hs|hidden sort key|sortkey|dummy|toc|clear|-|!|reflist|notelist|main|see also|further|portal|navbox.*|col-.*|div col.*)$/i

// {{!}} is a literal pipe inside a cell; it stands in until the cells are split.
const PIPE = '\u0001'

function renderTemplate(inner: string): string {
  const [rawName = '', ...rawArgs] = inner.split('|')
  const name = rawName.trim().toLowerCase().replace(/_/g, ' ')
  const named = (arg: string) => /^\s*[\w -]+\s*=/.test(arg) && !/^\s*[\w -]+\s*==/.test(arg)
  const args = rawArgs.filter((arg) => !named(arg)).map((arg) => arg.trim())
  const option = (key: string) => rawArgs.find((arg) => new RegExp(`^\\s*${key}\\s*=`).test(arg))?.split('=').slice(1).join('=').trim()
  if (name === '!') return PIPE
  if (/^('|'-|-'|`)$/.test(name)) return "'"
  if (name === "'s") return "'s"
  if (DROPPED.test(name)) return ''
  if (name === 'nbsp' || name === 'sp' || name === 'spaces') return ' '
  if (name === 'sort' || name === 'sorttext') return args[1] ?? args[0] ?? ''
  if (name === 'sortname') return args.slice(0, 2).join(' ')
  if (/^(dts|date|start date|sd|dtsa|start date and age|birth date)$/.test(name)) return args.join(' ')
  if (/^(lang|transl|lang-x)$/.test(name)) return args[1] ?? ''
  if (/^(ill|interlanguage link|interlanguage link multi)$/.test(name)) return option('lt') ?? args[0] ?? ''
  if (/^(unbulleted list|ubl|hlist|plainlist|flatlist)$/.test(name)) return args.join(' / ')
  return args[0] ?? ''
}

/** Wikitext with comments, footnotes, links, formatting and templates reduced to their visible text. */
export function renderWikitext(source: string): string {
  let text = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\[\[(?:File|Image|Category|Datei|Fájl|Kép):[^[\]]*(?:\[\[[^\]]*\]\][^[\]]*)*\]\]/gi, '')
    // A link's text may itself contain pipes ([[MARRS|M|A|R|R|S]]); they aren't table syntax.
    .replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, (_, _target: string, text: string) => text.replaceAll('|', PIPE))
    .replace(/\[\[([^\]]*)\]\]/g, (_, target: string) => target.replace(/^#/, ''))
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]*)\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/[^\]]*\]/g, '')
    .replace(/'''|''/g, '')
  // Innermost templates first, so nested ones resolve from the inside out.
  for (let pass = 0; pass < 25 && /\{\{[^{}]*\}\}/.test(text); pass++) text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => renderTemplate(inner))
  return text
}


/** A wikitable as simple HTML, with the year of the section heading above it (decade pages). */
export type WikitextTable = { html: string; year?: number }

/** The page's `wikitable` tables as simple HTML tables (outermost only). */
export function wikitextTables(source: string): WikitextTable[] {
  const out: WikitextTable[] = []
  type Row = { header: boolean; attributes: string; content: string }[]
  let rows: Row[] | null = null
  let wanted = false
  let depth = 0
  let headingYear: number | undefined
  let tableYear: number | undefined
  const cell = (part: string, header: boolean) => {
    // As in MediaWiki, whatever comes before a cell's first single pipe is its attributes ("rowspan=2 |").
    const split = /^([^|]*)\|(?!\|)([\s\S]*)$/.exec(part)
    const [attributes, content] = split ? [split[1].trim(), split[2]] : ['', part]
    // Only rowspan and colspan matter here; quotes are dropped, as editors sometimes leave one open.
    const spans = [...attributes.replaceAll(/["']/g, '').matchAll(/\b(rowspan|colspan)\s*=\s*(\d+)/gi)].map(([, key, value]) => `${key.toLowerCase()}="${value}"`)
    return { header, attributes: spans.join(' '), content: content.replaceAll(PIPE, '|') }
  }
  for (const line of renderWikitext(source).split('\n')) {
    const trimmed = line.trim()
    const heading = /^(=+)(.*)\1$/.exec(trimmed)
    if (heading && depth === 0) {
      headingYear = yearIn(heading[2])
      continue
    }
    if (trimmed.startsWith('{|')) {
      if (depth++ === 0) {
        rows = [[]]
        wanted = /\bwikitable\b/.test(trimmed)
        tableYear = headingYear
      }
      continue
    }
    if (!rows) continue
    if (trimmed.startsWith('|}')) {
      if (--depth === 0) {
        if (wanted) {
          const body = rows
            .filter((row) => row.length)
            .map((row) => `<tr>${row.map((c) => `<${c.header ? 'th' : 'td'} ${c.attributes}>${c.content}</${c.header ? 'th' : 'td'}>`).join('')}</tr>`)
          out.push({ html: `<table class="wikitable">${body.join('')}</table>`, year: tableYear })
        }
        rows = null
      }
      continue
    }
    if (depth > 1) continue
    const row = rows[rows.length - 1]
    if (trimmed.startsWith('|-')) rows.push([])
    else if (trimmed.startsWith('|+')) continue
    else if (trimmed.startsWith('!')) row.push(...trimmed.slice(1).split(/!!|\|\|/).map((part) => cell(part, true)))
    else if (trimmed.startsWith('|')) row.push(...trimmed.slice(1).split('||').map((part) => cell(part, false)))
    else if (row.length && trimmed) row[row.length - 1].content += ` ${trimmed}`
  }
  return out
}
