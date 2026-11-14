# Global Music Mapper

An interactive globe of the world's music. Spin it like a real globe, open any country to see what it is listening to right now, and zoom in to find the cities where its musicians were born, its bands were formed and its films were shot.

- **Charts (live):** Apple Music's most-played songs for 170 countries, and Shazam's top 50 for 175 cities (Paris, Berlin, New York…). Pressing play streams a 30-second preview from Deezer.
- **Made here (static):** for every country, up to 400 musicians and bands from Wikidata, by birthplace or place of formation, grouped into cities.
- **Filmed here (static):** up to 300 films per country by filming location, also from Wikidata, with posters from Wikipedia and links to IMDb.
- **Global Top 100 (live):** Shazam's worldwide chart, with each artist's country (from Wikidata) lit up on the globe.
- **Time machine:** a decade slider (before 1850 to the 2020s, with play) that colours countries by how many artists were born or bands formed there, and films made there, in that decade. Two markers show the decade's centre of gravity for music and for film, with a trail of where it has been; city markers and the panel's lists narrow to the decade.
- **Hits of the time:** with the time machine on, a country's chart tab shows its number-one singles year by year (Germany 1965, Japan 1985, Hungary 2005…), each playable as a preview. They come from Wikipedia's lists of number ones: 40 countries and about 1,300 country-years: from the 1940s for the US and Australia, the 1950s–60s for much of Western Europe, Latin America and Japan (19 countries in the 1960s), and later elsewhere. Hungary had no chart before the 1990s, so 1966–1972 shows the songs of the Táncdalfesztivál instead; where a decade has nothing, the tab says so and offers the nearest decade that has.
- **Song and artist search:** the search box (`⌘K`) also finds the 13,000 songs in those lists, and the artists who sang them. A song's card says when it was first at number one and where, with its release date when Deezer has the original, and lights up those countries; picking a country and year opens the time machine there, with the song picked out among that year's other number ones. 
- **All-time Top 30:** the global chart panel switches between Shazam's chart right now and an all-time Top 30 from the 40 countries' number ones: the songs that topped the most charts, counted against how many countries had a chart at the time (so the 1970s weigh as much as the 2010s), with where each artist comes from. Songs and artists open their cards.
- **Artists:** the search box also finds 50,000 musicians and bands: the globe's own, every Hungarian musician and band on Wikidata (Koncz Zsuzsa, Halott Pénz, Quimby…) and the world's better-known ones; anyone else, and any song at all, comes from Deezer's catalogue. An artist's card says where and when they were born or formed (and flies there), their career and releases decade by decade (each decade opens the time machine there, with their country's number ones of the time), their best-known songs and releases from Deezer, and their number ones.
- **Chart comparison:** any two charts side by side (Paris and Budapest, Japan and Brazil): the songs both play and each one's own. Any song can also show where else it is in a national chart right now, lit up on the globe.
- **Musical neighbours:** which countries' charts are most like this one's right now, as a list and as a colouring of the globe; any neighbour can be compared with in one click.
- **"Where's it from?" quiz:** ten rounds of 30-second previews. *Where?* plays a local hit (one that is in at most one other national chart) and you click its country on the globe, scored by distance. *When?* plays a well-known artist and you guess the decade they were born or formed in. Best scores are kept in the browser.
- **English and Hungarian:** the whole interface, country names and the 32 curated introductions and genre texts are translated. It follows the browser's language and remembers the choice from the top bar's HU/EN button.
- **Day and night:** the half of the Earth where it is night right now is shaded, with twilight; it updates every minute.
- **Rivers and lakes (static):** Natural Earth's rivers and lakes, in detail across Europe (the Zagyva, Tisza-tó), the major ones elsewhere, plus Hungarian waters Natural Earth lacks (Velencei-tó, Bodrog, Szamos…) from OpenStreetMap. Named in Hungarian inside Hungary, in English elsewhere.
- **Towns and villages (static):** every settlement in Hungary, Europe's towns of 15,000+ and the world's cities of 100,000+, from Wikidata and [GeoNames](https://www.geonames.org). They can be searched, and appear as dots and names when you zoom in.
- **Curated layer:** `src/data/countries.json` — 32 countries with a written introduction and 3–5 defining genres, each with its most-collected records from the [Discogs](https://www.discogs.com) API.

Charts and city data need no API keys. Only the Discogs records (the **Sounds** tab) need a token.

## Getting started

Requires Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env.local   # then paste your token into DISCOGS_TOKEN
npm run dev
```

Create a Discogs personal access token at **discogs.com → Settings → Developers**. Without it everything else works, and the Sounds tab explains that the token is missing.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server, including the `/api/charts`, `/api/preview` and `/api/discogs/search` functions. It runs React's development build, about twice as slow on the globe: judge speed with `npm run build && npm run preview`. |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve the production build (proxy included) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Builds the app and runs browser tests against it on desktop and mobile viewports (Playwright; charts, previews and Discogs mocked) |
| `npm run verify:data` | Checks `countries.json` and runs every genre's Discogs search live (needs the token; takes a few minutes because of Discogs' rate limit). `--only=br,jp` limits it to some countries. |
| `npm run verify:data:offline` | The static data checks only |
| `npm run lint` | Oxlint |
| `npm run build:water` | Rebuilds `public/data/water.json` (rivers and lakes) from Natural Earth, plus `scripts/.cache/osm/hu-extra.json` from OpenStreetMap when present. |
| `npm run build:gazetteer` | Rebuilds `public/data/gazetteer.json` (towns and villages) from Wikidata and GeoNames, in under a minute. Run it after `build:data`, which decides which countries exist. |
| `npm run build:hits` | Rebuilds `public/data/hits/` (the time machine's number ones) from Wikipedia's lists of number-one singles, in about two minutes (pages are fetched as wikitext, 50 per request, and cached in `scripts/.cache/hits`; `-- --offline` rebuilds from the cache, `-- --dry` lists which page each year comes from). |
| `npm run build:artists` | Rebuilds `api/_data/artists.json`, the artist search index, from the place files and Wikidata (about two minutes; answers cached in `scripts/.cache/artists`, `-- --offline` from the cache). Run it after `build:data`, and `build:hits` after it (the all-time Top 30 takes the artists' origins from it). |
| `npm run build:data` | Rebuilds `src/data/world.json` and `public/data/` from Wikidata, Shazam and Apple Music (about 30 minutes; queries are cached in `scripts/.cache`, so reruns are quick). `-- --only=hu,fr` re-queries some countries, `-- --offline` rebuilds from the cache. |

The first time you run the e2e tests, install the browser with `npx playwright install chromium`.

## How it works

- **Globe:** an orthographic projection from d3-geo, drawn as SVG. `src/hooks/useGlobeCamera.ts` turns drags into rotation (north stays up, and a fling keeps spinning with friction), zooms towards the cursor on wheel and pinch, and flies between countries along the great circle, zooming out on long trips. Frames are written straight to the DOM, so spinning never re-renders React. Shapes behind the horizon or off screen are skipped, and above 2.2× zoom the 1:50m outlines (loaded in the background) replace the bundled 1:110m ones.
- **Artists:** `scripts/build-artists.ts` gathers every musician and band from the place files, then asks Wikidata (through QLever) for every Hungarian musician and band and the world's musicians with 15+ Wikipedia articles and bands with 10+, with their birthplace or place of formation (a hospital stands for its town). Hungarian artists go by their Hungarian name, the English one kept as an alias. The result, `api/_data/artists.json` (50,000 artists), is too much to send to every visitor, so `api/artists.ts` searches it on the server, by any word of either name in any order. `api/search.ts` searches Deezer's catalogue for songs and artists beyond that. `api/discography.ts` asks Deezer for an artist's top tracks and releases (no compilations; a reissue keeps the original's date when Deezer has it). The card's career spans a band's formation, the artist's number ones and those releases, since Deezer often has only later reissues of old records.
- **Speed:** a frame only draws what can be on screen: country polygons are culled one by one (France's Guiana, Alaska) against the screen rectangle, not just the visible cap, and big polygons (Russia) stretch by stretch (`visibleGeometry` in `src/data/atlas.ts`, `screenCuller` in `src/utils/globe.ts`). Shapes wholly on the near side skip d3's clipping and are projected directly (`nearSidePath`), several times faster; distances use a plain haversine (`angleBetween`) instead of d3's exact but allocating `geoDistance`. Rivers and lakes are thinned to about a point per pixel for the zoom. City markers exist only around the view, clustering uses a grid on the unit sphere, and the idle spin runs at 25 frames a second for its first minute only. While the time machine changes decade, only the two centre-of-gravity markers move, one frame at a time (an earlier version requested a full redraw per marker per draw, which doubled the draws every frame). Effects redone on every frame are avoided: the selected country's glow is a wide stroke rather than a blur filter, and moving labels have no backdrop blur.
- **Cities:** from 2.8× zoom the globe loads the place files of the countries in view and clusters their cities on screen (`src/utils/cityClusters.ts`). A cluster zooms in; a single city opens in the panel. The Music and Films toggles choose what the markers count.
- **Time machine:** `scripts/build-world-data.ts` also writes `public/data/timeline.json` (~20 KB): per country and decade, how many artists and films; per decade, the centre of gravity (the normalised sum of every item's city as a 3D unit vector). Decades with fewer than 25 items get no centre, as a handful of 1890s films would only be noise. The decade is in the URL (`?decade=1960`).
- **Hits of the time:** `scripts/build-hits.ts` walks Wikipedia's "Lists of number-one songs" categories, picks one main singles chart per country and year (no album, genre or format charts; airplay only where nothing else exists), and reads its tables from the page's wikitext (`scripts/wikitable.ts`: templates, links and footnotes reduced to text, MediaWiki's cell rules, rowspans, year headings on decade pages, "weeks at number one" columns, and Billboard's early tables with the artist under the title). Wikitext is fetched 50 pages per request; Wikipedia throttles anonymous clients to a few requests a minute, so a page at a time would take over an hour. Each song's weeks at number one in that year order the list. `api/preview.ts?artist=…&title=…` finds the song itself on Deezer (`&details=1` adds its release date). The build also writes `songs.json`, every song with where and when it was number one: one song's spellings across countries ("(I Can't Get No) Satisfaction", "Satisfaction") are matched by `anySongKey` in `src/utils/hitSearch.ts`, which also searches it.
- **Comparison and "where else":** comparing fetches both charts (up to 50 songs) and matches songs by a key of lead artist and title without "(feat. …)" or punctuation, the same on server and client (`src/utils/songKey.ts`, `songKey` in `api/charts.ts`). `api/charts.ts?source=index` collects every country's national chart (16 at a time, within a 40-second budget, cached for an hour; a partial index is completed on the next request) for "where else is this charting?".
- **Musical neighbours:** `src/utils/similarity.ts` compares the top 25 of each country's chart in the chart index: the share of songs two charts have in common, out of the shorter one.
- **Quiz:** `src/hooks/useQuiz.ts` picks the songs (Where? from the national charts, When? from each country's best-known artists born or formed 1900–2009) and plays them from its own audio element, so the preview player's title never gives the answer away. Scoring is in `src/utils/quiz.ts`: 1,000 points for the right country, falling off with distance (about 370 at 1,500 km), and 1,000/600/300 for the right decade or one or two decades off.
- **Languages:** the messages are in `src/i18n/en.tsx` and `src/i18n/hu.tsx`; the Hungarian file is typed against the English one, so a missing key fails the build. Country names come from `Intl.DisplayNames`, with a few overrides. The curated texts' translations are in `src/data/countries.hu.json`, loaded only when Hungarian is on, and a unit test checks that every curated country and genre has one.
- **Day and night:** `src/utils/sun.ts` computes where the sun is overhead (NOAA's solar position formulas); the night side is ten nested caps around the opposite point, so twilight fades in.
- **Rivers and lakes:** `scripts/build-water.ts` simplifies and splits Natural Earth's lines into short pieces, delta-encodes them (~300 KB gzipped) and keeps each feature's zoom: the Volga shows from afar, the Zala only close up. The globe loads them once you zoom in, draws rivers thicker as they become relatively important, and names the biggest ones on screen, river names turned along the river.
- **Towns and villages:** `scripts/build-gazetteer.ts` writes 15,000 places, loaded when you search or zoom in. The globe draws them as dots on a canvas, and when the camera stops names as many as fit around the music markers (`placeLabels` in `src/utils/settlements.ts`). A town that is also a music city opens as that city; any other opens its country, with the globe pointing at it and the nearest music city one click away.
- **Charts:** `api/charts.ts` reads Apple Music's chart feed or Shazam's chart export, and matches each song on Deezer for a cover and a preview id. The global Top 100 loads 25 songs at a time, and looks up each artist's Deezer id on Wikidata for the country they come from (country of origin, then place of formation, birthplace, citizenship). `api/preview.ts` fetches a fresh preview link on play, because Deezer's links expire after about 15 minutes. Shazam has city charts for 175 cities; elsewhere, a city shows its country's chart and says so.
- **Data build:** `scripts/build-world-data.ts` asks Wikidata (through the [QLever](https://qlever.dev) SPARQL engine, which answers in seconds where query.wikidata.org times out) for each country's best-known musicians, bands and films, ranked by how many Wikipedias cover them. Districts, stations and landmarks merge into the most populous place nearby, so Pest and Buda become Budapest.
- **Discogs:** `src/services/discogsApi.ts` searches master releases for the genre's Discogs style and the country's release country, then ranks results by how many collectors own them and keeps the top three. If that finds too little, it searches the style worldwide, then by keyword, and the UI says when that happened.
- **State:** the selection lives in the URL (`?country=fr&city=Q90`, `?country=hu&place=Q305294`, `?view=top100`, `?decade=1960`, `?country=br&genre=bossa-nova`), so links can be shared and Back steps out of a city, then closes the panel.
- **Theme:** each country has an accent hue. The whole interface, the globe's atmosphere included, re-tints smoothly when you switch countries (`@property --accent` in `src/styles/index.css`).

### Project layout

```
api/charts.ts           Apple Music / Shazam charts, matched on Deezer (Vercel Function)
api/preview.ts          30-second Deezer previews (Vercel Function)
api/discogs/search.ts   Discogs proxy (Vercel Function)
api/artists.ts          Artist search over api/_data/artists.json (Vercel Function)
api/discography.ts      An artist's top tracks and releases on Deezer (Vercel Function)
api/search.ts           Songs and artists from Deezer's catalogue (Vercel Function)
scripts/                Data build and Discogs mapping checks
public/data/            Per-country cities, artists and films; city search index; towns and villages; rivers and lakes; number ones by year
src/components/         Layout/, Map/ (globe), Sidebar/ (panel tabs), Search/, Player/, UI/
src/data/               world.json, countries.json (+ countries.hu.json) and atlas helpers
src/i18n/               English and Hungarian messages, language context
src/hooks/              globe camera, URL selection, data queries, player
src/utils/globe.ts      Projection and camera math
tests/e2e/              Playwright tests
```

### Editing the data

Each genre in `countries.json` has a `discogs` query: a Discogs `style` and/or `genre`, an optional `q`, and options for the fallback behaviour:

- **`keepCountry`:** never search worldwide. Use it for generic styles like "Folk".
- **`country`:** override the release country, or `null` to search all countries.
- **`keyword`:** the keyword-search term.

Discogs style names must match its taxonomy exactly. Run `npm run verify:data -- --only=<iso2>` after editing.

## Deploying

The project deploys to Vercel as is: the Vite build is detected automatically, and each file in `api/` becomes a serverless function. Set `DISCOGS_TOKEN` in the Vercel project's environment variables.

## Keyboard

`⌘K` / `Ctrl K` or `/` search · `Esc` leave a city, then close · `?` about. With the globe focused: arrow keys turn it, `+` `−` zoom, `Enter` opens the country in the middle. In the panel, `←` `→` switch tabs and genres.

## Credits

Charts from Apple Music and Shazam; previews from Deezer. Artists, birthplaces, filming locations and Hungarian settlements from Wikidata (CC0). Towns and cities outside Hungary from GeoNames (CC BY 4.0). Rivers and lakes from Natural Earth (public domain) and, for a few Hungarian ones, © OpenStreetMap contributors (ODbL). Film posters are the lead images of English Wikipedia articles, which Wikipedia uses under fair use. Release data provided by Discogs. Map data from Natural Earth via world-atlas. Flags from country-flag-icons.
This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs. "Discogs" is a trademark of Zink Media, LLC.
