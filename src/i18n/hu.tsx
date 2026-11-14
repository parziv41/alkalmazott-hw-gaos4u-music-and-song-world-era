// Magyar szövegek. Ugyanolyan szerkezetű, mint az en.tsx; a TypeScript ellenőrzi, hogy semmi ne maradjon ki.
// A változó nevek (ország, város) sosem kapnak ragot: a mondatok úgy vannak megfogalmazva, hogy ne kelljen.
import type { ReactNode } from 'react'
import type { Messages } from './en'
import { huArticle, huDecade } from './format'

const n = (value: number) => value.toLocaleString('hu-HU')
const link = (href: string, text: string) => (
  <a className="text-accent hover:underline" href={href} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
)

export const hu: Messages = {
  locale: 'hu-HU',
  language: { other: 'English', switch: 'Switch to English (angol nyelvű felület)' },
  common: {
    close: 'Bezárás',
    play: 'Lejátszás',
    pause: 'Szünet',
    tryAgain: 'Újra',
    done: 'Kész',
    showFewer: 'Kevesebb',
    showAll: (count: number) => `Mind a ${count} mutatása`,
    showMore: (count: number, rest: number) => `Még ${count} a(z) ${rest} közül`,
    artists: (count: number) => `${n(count)} előadó`,
    films: (count: number) => `${n(count)} film`,
    cities: (count: number) => `${n(count)} város`,
    sounds: (count: number) => `${n(count)} műfaj`,
    people: (count: number) => `${n(count)} lakos`,
    cityChart: 'városi toplista',
    wikipedia: 'Wikipédia',
    onWikipedia: (name: string) => `${name} – Wikipédia`,
    onImdb: (name: string) => `${name} – IMDb`,
  },
  decade: {
    label: (decade: number) => (decade < 1850 ? '1850 előtt' : `${huDecade(decade)} évek`),
    inThe: (decade: number) => (decade < 1850 ? '1850 előtt' : `${huArticle(decade)} ${huDecade(decade)} években`),
  },
  topBar: {
    home: 'Global Music Mapper – kezdőlap',
    search: 'Keresés országok, városok és műfajok között',
    searchShort: 'Országok, városok, műfajok',
    top100: 'Világ Top 100',
    top100Short: 'Top 100',
    timeMachine: 'Időgép',
    quiz: 'Honnan szól? – kvíz',
    surprise: 'Meglepetés',
    about: 'A térképről',
  },
  chrome: {
    music: 'Zene',
    films: 'Filmek',
    showOnGlobe: 'Mi látszódjon a földgömbön',
    summary: (countries: number, cities: string, curated: number) => `${countries} ország · ${cities} város · ${curated} részletesen bemutatva`,
    data: 'Adatok',
    map: 'Térkép',
    zoom: 'Nagyítás',
    zoomIn: 'Nagyítás',
    zoomOut: 'Kicsinyítés',
    reset: 'Alapnézet',
    dayNight: 'Nappal és éjszaka mutatása',
    hideDayNight: 'Nappal és éjszaka elrejtése',
    hint: 'Forgasd a földgömböt, görgess rá egy országra a városaiért',
    hintSearch: (key: ReactNode) => <> – vagy nyomd meg: {key} a kereséshez</>,
    dismissHint: 'Tipp bezárása',
  },
  about: {
    title: 'Global Music Mapper',
    intro: (countries: number, curated: number, genres: number) =>
      `Földgömb arról, mit hallgat a világ, és honnan származik a zenéje és a filmje. ${countries} országhoz és területhez mutatja az aktuális toplistát (ahol közölnek ilyet), az egyes városokban született zenészeket és alakult együtteseket, az ott forgatott filmeket, valamint a világ Top 100-as listáját azzal együtt, honnan jönnek a slágerek. Az időgép megmutatja, hogyan vándorolt a zene és a film évtizedről évtizedre, bármely két toplista összevethető, a zenei szomszédok megmutatják, mely országok hallgatnak hasonló zenét, a „Honnan szól?” kvízzel a füledet tesztelheted, és a földgömbön az is látszik, hol van éppen éjszaka. ${curated} országhoz kézzel írt bemutató is tartozik ${genres} meghatározó műfajról, a Discogs leggyűjtöttebb lemezeivel.`,
    shortcuts: 'Billentyűparancsok',
    keys: {
      search: 'Keresés országok, városok és műfajok között',
      slash: 'Keresés',
      arrows: 'Műfajváltás',
      escape: 'A panel bezárása',
      help: 'Ez az ablak',
    },
    gestures:
      'Húzással forgathatod a földgömböt, görgetéssel vagy csippentéssel nagyíthatsz. Nagyításkor megjelennek a városok; ha a földgömb van kijelölve, a nyilakkal forgatható, az Enter pedig megnyitja a középen lévő országot.',
    credits: 'Források',
    creditList: [
      <>
        Toplisták: Apple Music és {link('https://www.shazam.com/charts', 'Shazam')}; 30 másodperces előnézetek: {link('https://www.deezer.com', 'Deezer')}.
      </>,
      <>
        Előadók, születési helyek és forgatási helyszínek: {link('https://www.wikidata.org', 'Wikidata')} (CC0), aszerint rangsorolva, hány Wikipédia ír
        róluk.
      </>,
      <>
        Városok és falvak: Wikidata és {link('https://www.geonames.org', 'GeoNames')} (CC BY 4.0). Filmplakátok: Wikipédia, filmes adatok: IMDb.
      </>,
      <>
        Folyók és tavak: Natural Earth, néhány magyar víz esetében pedig az {link('https://www.openstreetmap.org/copyright', 'OpenStreetMap')}{' '}
        közreműködői (©).
      </>,
      <>Lemezadatok: {link('https://www.discogs.com', 'Discogs')}.</>,
      <>Térképadatok: Natural Earth (world-atlas). Zászlók: country-flag-icons.</>,
    ] as ReactNode[],
    discogsNotice:
      'Ez az alkalmazás a Discogs API-ját használja, de nem áll kapcsolatban a Discogsszal, és az nem is támogatja vagy hagyja jóvá. A „Discogs” a Zink Media, LLC védjegye.',
  },
  search: {
    label: 'Keresés országok, városok, települések, műfajok, dalok és előadók között',
    title: 'Keresés',
    description: 'Keress egy országot, várost, műfajt, listavezető dalt vagy előadót, és nyisd meg a földgömbön.',
    placeholder: 'Országok, városok, dalok, előadók…',
    loading: 'Helyek betöltése…',
    empty: 'Nincs találat.',
    songs: 'Dalok',
    artists: 'Előadók',
    hasHits: 'Volt listavezető dala',
    songMeta: (first: number, countries: number) => `${first} · ${n(countries)} ország`,
    artistMeta: (songs: number, first: number, last: number) => `${n(songs)} dal · ${first === last ? first : `${first}–${last}`}`,
    cities: 'Városok zenével és filmmel',
    towns: 'Települések',
    countries: 'Országok',
    genres: 'Műfajok',
    hasChart: 'Van városi toplistája',
    navigate: 'léptetés',
    open: 'megnyitás',
  },
  player: {
    region: 'Előnézet lejátszó',
    noPreview: 'Ehhez nincs előnézet',
    finding: 'Előnézet keresése…',
    openDeezer: 'Megnyitás a Deezeren',
    close: 'Lejátszó bezárása',
    playLabel: (what: string) => `Előnézet lejátszása: ${what}`,
    pauseLabel: (what: string) => `Szünet: ${what}`,
    noPreviewTitle: 'Nincs elérhető előnézet',
    playTitle: 'Előnézet lejátszása',
    trackBy: (title: string, artist: string) => `${title} – ${artist}`,
  },
  panel: {
    expand: 'Panel kinyitása',
    collapse: 'Panel összecsukása',
    tabsLabel: 'Mit mutasson',
    tabs: { charts: 'Toplista', artists: 'Előadók', films: 'Filmek', sounds: 'Műfajok' },
    credits: {
      charts: 'Toplisták: Apple Music és Shazam',
      previews: 'Előnézetek: Deezer',
      wikidata: 'Adatok: Wikidata',
      discogs: 'Lemezadatok: Discogs',
      hits: 'Listavezetők: Wikipédia',
    },
  },
  tooltip: { topSongs: 'Toplista', noData: 'Még nincs zenei adat' },
  globe: {
    label:
      'Földgömb. Húzással vagy a nyilakkal forgatható, görgetéssel vagy a plusz és mínusz billentyűvel nagyítható, az Enter megnyitja a középen lévő országot. Kereséshez nyomd meg a perjelet.',
    ocean: 'Óceán',
    decadeNote: (label: string, artists: number, films: number) => `${label}: ${n(artists)} előadó · ${n(films)} film`,
    clusterLabel: (count: number, city: string, counts: string) => `${count} hely ${city} környékén: ${counts}. Nagyíts rá`,
    cityLabel: (city: string, country: string, nearby: number, counts: string, chart: boolean) =>
      `${city}, ${country}${nearby ? ` és ${nearby} közeli hely` : ''}: ${counts}${chart ? ', városi toplista' : ''}`,
    musicCentre: (label: string) => `A zene súlypontja – ${label}`,
    filmCentre: (label: string) => `A film súlypontja – ${label}`,
  },
  chart: {
    noChart: 'Itt nem közölnek toplistát',
    noChartText: (country: string) => `Sem az Apple Music, sem a Shazam nem közöl toplistát ehhez az országhoz (${country}).`,
    hearArtists: (country: string) => `Hallgass bele a helyi előadókba (${country}) →`,
    mostShazamed: (where: string) => `Legtöbbet Shazamolt dalok: ${where}`,
    topSongs: (where: string) => `Toplista: ${where}`,
    shazam: (period: string) => `Shazam · ${period}`,
    apple: (period: string) => `Apple Music · ${period}`,
    period: (_period: string | undefined, source: 'apple' | 'shazam') => (source === 'apple' ? 'a mai legtöbbet játszott dalok' : 'az elmúlt 7 nap'),
    area: 'Melyik lista',
    national: 'Országos',
    noCityChart: (city: string, country: string) => `A Shazam nem közöl városi toplistát (${city}), ezért itt az országos lista látható (${country}).`,
    cityCharts: 'Városi toplisták',
    empty: 'Ez a lista most üres',
    failed: 'Nem sikerült betölteni a listát',
    emptyText: 'A szolgáltató most nem ad listát ehhez a helyhez.',
    failedText: 'Ellenőrizd a kapcsolatot, és próbáld újra.',
    showTop10: 'Csak a top 10',
    open: (title: string) => `Megnyitás: ${title}`,
    compare: 'Összehasonlítás egy másik hellyel',
    whoListens: () => 'Hol hallgatnak hasonló zenét?',
    whereElse: (title: string) => `Hol szól még: ${title}?`,
    whereElseTitle: 'Hol szól még?',
  },
  compare: {
    placeholder: 'Összehasonlítás… (Budapest, Japán, Párizs)',
    placeLabel: 'Melyik hellyel hasonlítsuk össze',
    cancel: 'Összehasonlítás megszakítása',
    places: 'Helyek toplistával',
    noPlace: 'Ehhez a helyhez nincs toplista.',
    national: 'Országos toplista',
    cityChart: (country: string) => `Városi toplista · ${country}`,
    region: (a: string, b: string) => `${a} és ${b} összehasonlítása`,
    failed: 'Az egyik listát nem sikerült betölteni. Próbáld újra egy kicsit később.',
    summary: (shared: number, percent: number) => (
      <>
        <span className="font-medium text-hi">{shared}</span> dal szerepel mindkét listán (a rövidebb lista {percent}%-a).
      </>
    ),
    inBoth: 'Mindkettőn',
    nothingShared: 'Nincs közös dal: a két helyen teljesen mást hallgatnak.',
    onlyIn: (place: string, count: number) => `Csak itt: ${place} · ${count}`,
  },
  neighbours: {
    region: (country: string) => `Hasonló zenei ízlésű országok (${country})`,
    title: 'Zenei szomszédok',
    explain: (country: string, top: number) =>
      `${country} top ${top} dala közül hány szerepel az egyes országok listáján is. A földgömb ugyanígy van színezve.`,
    hide: 'Zenei szomszédok elrejtése',
    loading: 'Az összes ország toplistájának összegyűjtése… először nagyjából fél percig tart.',
    failed: 'A többi ország listáját most nem sikerült betölteni.',
    none: (country: string) => `Most egyetlen ország listáján sincs olyan dal, amely ${country} listáján is szerepel.`,
    compare: (a: string, b: string) => `${a} és ${b} listájának összehasonlítása`,
    compareTitle: 'Listák összehasonlítása',
    partial: 'Néhány ország listája még töltődik; hamarosan kiegészül.',
  },
  spotlight: {
    region: (title: string) => `Hol szól: ${title}`,
    heading: 'Hol van a listákon',
    loading: 'Az összes ország listájának átnézése… először fél percig is tarthat.',
    failed: 'A listákat most nem sikerült betölteni.',
    none: (checked: number) => `Most egyik ország listáján sincs rajta (${checked} országos listából).`,
    inCharts: (count: number, checked: number) => (
      <>
        <span className="font-medium text-hi">{count}</span> ország listáján szerepel ({checked} közül):
      </>
    ),
    seeOnGlobe: 'Mutasd a földgömbön',
    partial: 'Néhány ország listája még töltődik; hamarosan kiegészül.',
  },
  places: {
    topCities: 'Legtöbb előadó és film',
    madeIn: (where: string) => `Helyi előadók – ${where}`,
    filmedIn: (where: string) => `Itt forgatott filmek – ${where}`,
    artistsSummary: (count: number, decade: string | null) =>
      `${n(count)} itt született zenész és itt alakult együttes${decade ? ` ${decade}` : ''}, a legismertebbek elöl`,
    filmsSummary: (count: number, decade: string | null) =>
      `${n(count)} film, amelyet itt forgattak${decade ? ` (bemutató ${decade})` : ''}, a legismertebbek elöl`,
    findingArtists: 'Helyi előadók keresése…',
    findingFilms: 'Filmek keresése…',
    noArtists: 'Nincs ismert előadó',
    noArtistsText: (where: string) => `A Wikidata még nem tart nyilván ismert zenészt, aki itt született (${where}).`,
    noArtistsDecade: (where: string, decade: string) => `A legismertebb helyi zenészek közül egy sem született itt ${decade} (${where}).`,
    noFilms: 'Nincs ismert film',
    noFilmsText: (where: string) => `A Wikidata nem tart nyilván ismert filmet, amelyet itt forgattak (${where}).`,
    noFilmsDecade: (where: string, decade: string) => `Egyetlen itt forgatott ismert film sem jelent meg ${decade} (${where}).`,
    allDecades: (decade: string) => `Minden évtized mutatása (ne csak: ${decade})`,
    group: 'Együttes',
    born: (year: number) => `született ${year}`,
    formed: (year: number) => `alakult ${year}`,
    directedBy: (name: string) => `Rendező: ${name}`,
  },
  placeBanner: {
    region: (name: string) => `Kiválasztott hely: ${name}`,
    nearest: (city: string, km: number) => `Legközelebb a zenei térképen: ${city}, ${km} km`,
    clear: (name: string) => `${name} törlése`,
  },
  country: {
    close: 'Bezárás',
    back: 'Vissza:',
  },
  sounds: {
    local: 'Helyi műfajok',
    genresOf: (country: string) => `Műfajok (${country})`,
    moreOnDiscogs: (genre: string) => `Még több ${genre} a Discogson ↗`,
    records: 'Alapvető lemezek',
    viaDiscogs: 'a Discogs alapján',
    loadingRecords: 'Lemezek keresése…',
    rateLimited: 'A Discogs pihen egy kicsit, újrapróbálom…',
    noRecords: 'Nincs találat',
    noRecordsText: (genre: string, country: string) => `A Discogson még nincs elég részletes ${genre} kiadás ebből az országból (${country}).`,
    searchDiscogs: 'Keresés a Discogson ↗',
    tokenMissing: 'Hiányzik a Discogs token',
    tokenMissingText: (
      <>
        Add hozzá a <code className="font-mono text-hi">DISCOGS_TOKEN</code> értéket a <code className="font-mono text-hi">.env.local</code> fájlhoz, majd
        indítsd újra a fejlesztői szervert.
      </>
    ),
    unreachable: 'Nem érhető el a Discogs',
    resting: 'A Discogsnak szüksége van egy kis szünetre',
    restingText: 'Túl sok kérés érkezett rövid idő alatt. Próbáld újra pár másodperc múlva.',
    connection: 'Ellenőrizd a kapcsolatot, és próbáld újra.',
    global: (country: string) => `Kevés a helyi kiadás a Discogson (${country}), ezért más országok kiadásai is szerepelnek.`,
    keyword: (keyword: string) => `Kulcsszavas keresés a Discogson: „${keyword}”.`,
    announce: {
      loaded: (count: number, genre: string) => `${count} lemez betöltve: ${genre}`,
      loading: (genre: string) => `Lemezek betöltése: ${genre}`,
      none: (genre: string) => `Nincs lemez: ${genre}`,
      failed: 'Nem sikerült betölteni a lemezeket',
    },
  },
  allTime: {
    heading: 'Minden idők Top 30',
    label: '40 ország listavezetői alapján, 1940–2026',
    intro: 'A dalok, amelyek a legtöbb ország listáját vezették, ahhoz mérve, hány ország közölt akkor slágerlistát: így a 70-es évek ugyanannyit nyomnak, mint a 2010-esek. Kattints egy dalra vagy előadóra a részletekért.',
    share: (count: number, of: number) => `${n(count)} ország élén (${n(of)} listából)`,
    origins: 'Honnan származnak',
    failed: 'Nem sikerült betölteni a listát',
    credits: 'Listavezetők: Wikipédia · Származás: Wikidata · Előnézetek: Deezer',
    modes: 'Melyik lista',
    now: 'Most',
    allTime: 'Minden idők',
  },
  top100: {
    heading: 'Világ Top 100',
    intro: 'A világon most legtöbbet Shazamolt dalok, és hogy honnan származnak az előadóik. Nyomj a lejátszásra, és hallgass bele 30 másodpercig.',
    origins: 'Honnan jönnek a slágerek',
    list: 'Világlista',
    failed: 'Nem sikerült betölteni a világlistát',
    failedText: 'Ellenőrizd a kapcsolatot, és próbáld újra.',
    loadingMore: (from: number, to: number) => `${from}–${to}. helyezés betöltése…`,
    loadMoreFailed: 'Nem sikerült többet betölteni. Újra',
    credits: 'Lista: Shazam · Előnézetek: Deezer · Az előadók országa: Wikidata',
    unknownOrigin: 'Ismeretlen származás',
  },
  timeMachine: {
    region: 'Időgép',
    play: 'Végigjátszás az évtizedeken',
    born: 'Született előadók és alakult együttesek',
    made: 'Elkészült filmek',
    slider: 'Évtized',
    close: 'Időgép bezárása',
    note: 'Előadók a születésük vagy megalakulásuk, filmek a bemutatójuk éve szerint; országonként a Wikidata legismertebbjei. Nyiss meg egy országot, és meghallgathatod az akkori slágereit.',
    charts: 'Országok slágerlistával ebben az évtizedben',
  },
  artistCard: {
    region: (name: string) => `Előadó: ${name}`,
    heading: 'Előadó',
    born: (year: number) => `Született: ${year}`,
    formed: (year: number) => `Alakult: ${year}`,
    person: 'Zenész',
    group: 'Együttes',
    showOrigin: (city: string) => `Mutasd a földgömbön (${city})`,
    career: (first: number, last: number) => (first === last ? `Pályája: ${first}` : `Pályája: ${first}–${last}`),
    decades: 'Kiadványok évtizedenként',
    decadeButton: (label: string, count: number) => `${label}: ${n(count)} kiadvány. Időgép megnyitása ott`,
    decadeHint: 'Csíkok: kiadványok a Deezeren; kupák: listavezető dalok. Válassz egy évtizedet: az időgép oda ugrik, és megmutatja, mi volt akkor listavezető.',
    topSongs: 'Legismertebb dalai',
    releases: 'Kiadványai',
    type: (type: string) => ({ album: 'album', single: 'kislemez', ep: 'EP' })[type] ?? type,
    numberOnes: 'Listavezető dalai',
    loading: 'Adatok a Deezertől…',
    noDeezer: 'Nincs fent a Deezeren, így dalokat és kiadványokat nem tudok mutatni.',
    failed: 'Most nem sikerült elérni a Deezert.',
  },
  history: {
    region: (title: string) => `Dal: ${title}`,
    song: 'Listavezető dal',
    plainSong: 'Dal',
    album: (title: string) => `Album: ${title}`,
    openArtist: (name: string) => `Bővebben: ${name}`,
    notNumberOne: 'A gyűjtött 40 ország listáin nem volt listavezető.',
    artist: 'Listavezető dalai',
    first: (year: number, country: string) => `Először listavezető: ${year} (${country})`,
    firstYear: (year: number) => `Először listavezető: ${year}`,
    released: (date: string) => `Megjelent: ${date} (Deezer)`,
    countries: (count: number) => `Listavezető volt ${n(count)} országban:`,
    weeks: (count: number) => `${n(count)} hét`,
    festival: 'fesztivál',
    hint: 'Válassz egy évet: megmutatja, mi volt még akkor listavezető abban az országban.',
    open: (country: string, year: number) => `Listavezetők – ${country}, ${year}`,
    artistSummary: (songs: number, countries: number, first: number, last: number) =>
      `${n(songs)} listavezető dal, ${n(countries)} ország, ${first === last ? first : `${first}–${last}`}`,
    back: (artist: string) => `Az összes dala (${artist})`,
    showOnGlobe: 'Mutasd a földgömbön',
  },
  hits: {
    tab: 'Slágerek',
    years: 'Év',
    title: (where: string, year: number) => `Listavezetők – ${where}, ${year}`,
    festival: (year: number) => `Táncdalfesztivál ${year}`,
    festivalNote: 'Magyarországon ekkor még nem volt slágerlista: ezek a Magyar Televízió Táncdalfesztiváljának dalai, elöl a díjazottak.',
    cityNote: () => 'A korabeli slágerlisták országosak, ez az egész ország listája.',
    weeks: (count: number) => `${n(count)} hétig első`,
    prize: (note: string) => note,
    source: (page: string) => `Forrás: Wikipédia, „${page}”`,
    loading: 'Slágerek betöltése…',
    failed: 'Nem sikerült betölteni a slágereket',
    failedText: 'Ellenőrizd a kapcsolatot, és próbáld újra.',
    none: (_where: string, decade: number) => {
      if (decade < 1850) return '1850 előttről nincs slágerlista'
      const article = huArticle(decade)
      return `${article[0].toUpperCase()}${article.slice(1)} ${huDecade(decade)} évekből nincs slágerlista`
    },
    noneText: 'A Wikipédián nincs listavezető-lista ezekből az évekből. Az Előadók fülön láthatod, kik születtek vagy alakultak itt akkoriban.',
    showArtists: 'Az évtized előadói',
    jump: (label: string) => `Ugrás: ${label}`,
    today: 'Mai toplista',
  },
  quiz: {
    region: 'Honnan szól? – kvíz',
    title: 'Honnan szól?',
    round: (current: number, of: number, points: string) => `${current}/${of}. kör · ${points} pont`,
    close: 'Kvíz bezárása',
    modes: {
      where: { title: 'Hol?', text: 'Egy helyi sláger szól. Kattints arra az országra, amelyiknek a toplistájáról való.' },
      when: { title: 'Mikor?', text: 'Egy ismert előadó szól. Találd ki, melyik évtizedben született, illetve alakult.' },
    },
    best: (points: string) => `Legjobb: ${points}`,
    rounds: (count: number) => `${count} kör`,
    play: 'Játék →',
    pickingHit: 'Helyi sláger keresése…',
    pickingArtist: 'Előadó keresése…',
    noSong: 'Most nem találtam lejátszható dalt.',
    clickCountry: 'Kattints arra az országra, ahonnan szerinted ez a sláger való.',
    decadeGroup: 'Az előadó születésének vagy megalakulásának évtizede',
    whenQuestion: 'Mikor született ez az előadó, vagy mikor alakult ez az együttes?',
    decadeButton: (decade: number) => huDecade(decade),
    skip: 'Kihagyom',
    bornOrFormed: (year: number) => `· született vagy alakult: ${year}`,
    next: 'Következő dal →',
    seeScore: 'Eredmény',
    skipped: 'Kihagyva.',
    spotOn: 'Telitalálat!',
    picked: (country: string, km: string) => `A tipped: ${country}, ${km} km-re.`,
    rightDecade: 'Eltaláltad az évtizedet!',
    wrongDecade: (guess: number, answer: number) => `A tipped: ${huDecade(guess)} évek; a helyes: ${huDecade(answer)} évek.`,
    newBest: 'Új rekord!',
    yourBest: (points: string) => `Eddigi legjobb: ${points}.`,
    roundsLabel: 'Körök',
    again: 'Újra',
    tryMode: (title: string) => `Kipróbálom: „${title}”`,
    verdict: (share: number) =>
      share >= 0.85
        ? 'Világklasszis fül!'
        : share >= 0.6
          ? 'Sokat utazott fül.'
          : share >= 0.35
            ? 'Nem rossz, világjáró!'
            : 'Ideje egy kicsit többet hallgatni a nagyvilág zenéjét.',
  },
}
