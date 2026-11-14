// Every flag as its own small SVG file, fetched only when it is shown. `?no-inline` keeps Vite
// from inlining the small ones into the JavaScript bundle as data URLs.
const files = import.meta.glob<string>('/node_modules/country-flag-icons/3x2/*.svg', {
  query: '?no-inline',
  import: 'default',
  eager: true,
})

const FLAGS = new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]))

export function flagFor(iso2: string): string | undefined {
  return FLAGS.get(iso2.toUpperCase())
}
