import { expect, test, type Page } from '@playwright/test'
import { mockDiscogs, mockMusic } from './fixtures.ts'

const HUNGARY = '[data-country="348"]'
const PARIS = 'Q90'
const PECS = 'Q45779'
const ABALIGET = 'Q305294'

const panel = (page: Page) => page.locator('aside[aria-labelledby="country-heading"]')
const heading = (page: Page, name: string) => panel(page).getByRole('heading', { level: 2, name })
const chartRows = (page: Page) => panel(page).locator('ol[aria-label] > li')
const records = (page: Page) => panel(page).locator('section[aria-labelledby="records-heading"] ol > li')

async function mockAll(page: Page) {
  await mockDiscogs(page)
  return mockMusic(page)
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout only')

  test('clicking a country on the globe opens its national chart, Escape closes it', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto('/')
    await page.locator(HUNGARY).click()

    await expect(heading(page, 'Hungary')).toBeVisible()
    await expect(page).toHaveURL(/country=hu/)
    await expect(panel(page).getByRole('tab', { name: 'Top songs' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel(page).getByRole('heading', { name: 'Top songs in Hungary' })).toBeVisible()
    await expect(chartRows(page)).toHaveCount(10)
    expect(music.charts.at(-1)?.searchParams.get('source')).toBe('apple')
    expect(music.charts.at(-1)?.searchParams.get('cc')).toBe('hu')

    await panel(page).getByRole('button', { name: 'Show all 25' }).click()
    await expect(chartRows(page)).toHaveCount(25)

    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(page).not.toHaveURL(/country=/)
  })

  test('a city with its own chart shows what that city plays', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto(`/?country=fr&city=${PARIS}`)
    await expect(heading(page, 'Paris')).toBeVisible()
    await expect(panel(page).getByRole('heading', { name: 'Most Shazamed in Paris' })).toBeVisible()
    await expect(chartRows(page).first()).toContainText('paris hit 1')
    expect(music.charts.at(-1)?.searchParams.get('city')).toBe('paris')

    await panel(page).getByRole('button', { name: 'National' }).click()
    await expect(panel(page).getByRole('heading', { name: 'Top songs in France' })).toBeVisible()
    await expect(chartRows(page).first()).toContainText('fr hit 1')
  })

  test('a city without a chart says so and falls back to the national chart', async ({ page }) => {
    await mockAll(page)
    await page.goto(`/?country=hu&city=${PECS}`)
    await expect(heading(page, 'Pécs')).toBeVisible()
    await expect(panel(page).getByText('Shazam doesn’t publish a city chart for Pécs')).toBeVisible()
    await expect(panel(page).getByRole('heading', { name: 'Top songs in Hungary' })).toBeVisible()

    // Back to the country, then out of the panel.
    await page.keyboard.press('Escape')
    await expect(heading(page, 'Hungary')).toBeVisible()
    await expect(page).not.toHaveURL(/city=/)
  })

  test('artists made in a city play a preview', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto(`/?country=hu&city=${PECS}`)
    await panel(page).getByRole('tab', { name: 'Artists' }).click()
    await expect(panel(page).getByRole('heading', { name: 'Made in Pécs' })).toBeVisible()
    const play = panel(page).getByRole('button', { name: /^Play a preview of / }).first()
    await play.click()
    await expect(page.getByRole('region', { name: 'Preview player' })).toContainText('Best of')
    expect(music.previews.length).toBe(1)
    await page.getByRole('button', { name: 'Close player' }).click()
    await expect(page.getByRole('region', { name: 'Preview player' })).toHaveCount(0)
  })

  test('films shot in a country link to their city', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    await panel(page).getByRole('tab', { name: 'Films' }).click()
    await expect(panel(page).getByRole('heading', { name: 'Filmed in Hungary' })).toBeVisible()
    await panel(page).getByRole('button', { name: /^Budapest/ }).first().click()
    await expect(heading(page, 'Budapest')).toBeVisible()
    await expect(panel(page).getByRole('heading', { name: 'Filmed in Budapest' })).toBeVisible()
  })

  test('search finds a city without accents', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder('Countries, cities, songs, artists…').fill('pecs')
    await page.getByRole('option', { name: /^Pécs · Hungary/ }).first().click()
    await expect(heading(page, 'Pécs')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`city=${PECS}`))
  })

  test('search finds a village and the globe points at it', async ({ page }) => {
    test.slow() // loads the 15,000-place gazetteer and a country's places
    await mockAll(page)
    await page.goto('/')
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder('Countries, cities, songs, artists…').fill('abaliget')
    await page.getByRole('option', { name: /^Abaliget · Baranya, Hungary/ }).click()
    await expect(heading(page, 'Hungary')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`place=${ABALIGET}`))
    const banner = panel(page).getByRole('region', { name: 'Selected place: Abaliget' })
    await expect(banner).toContainText('615 people')
    await expect(page.locator(`.settlement-label[data-settlement="${ABALIGET}"]`)).toBeVisible()

    await banner.getByRole('button', { name: /Nearest on the music map: Pécs/ }).click()
    await expect(heading(page, 'Pécs')).toBeVisible()
  })

  test('zooming into Hungary names its towns and villages', async ({ page }) => {
    test.slow()
    await mockAll(page)
    await page.goto('/?country=hu')
    await expect(heading(page, 'Hungary')).toBeVisible()
    const label = page.locator('.settlement-label').first()
    await expect(label).toBeVisible()
    expect(await page.locator('.settlement-label').count()).toBeGreaterThan(10)
    // Rivers and lakes are drawn and named, in Hungarian inside Hungary.
    await expect(page.locator('.water-rivers.is-major')).toHaveAttribute('d', /M/)
    await expect(page.locator('.water-lakes')).toHaveAttribute('d', /M/)
    await expect(page.locator('.water-label', { hasText: /^Balaton$/ })).toBeVisible()
    // Which towns fit depends on the screen; any of them opens with its name in the panel.
    const name = (await label.textContent())!
    await label.click()
    await expect(panel(page).getByText(name, { exact: true }).first()).toBeVisible()
  })

  test('the global Top 100 lists songs with where their artists come from', async ({ page }) => {
    test.slow()
    const music = await mockAll(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Global Top 100' }).click()
    const global = page.locator('aside[aria-labelledby="global-heading"]')
    await expect(global.getByRole('heading', { level: 2, name: 'Global Top 100' })).toBeVisible()
    await expect(global.locator('ol[aria-label="Global chart"] > li')).toHaveCount(100)
    expect(music.charts.map((url) => url.searchParams.get('offset'))).toEqual(['0', '25', '50', '75'])
    await expect(page).toHaveURL(/view=top100/)
    // The countries the hits come from light up on the globe.
    await expect(page.locator('.country.is-charting[data-country="840"]')).toHaveCount(1)

    await global.getByRole('button', { name: /^United States/ }).first().click()
    await expect(heading(page, 'United States')).toBeVisible()
    await page.goBack()
    await expect(global.getByRole('heading', { level: 2, name: 'Global Top 100' })).toBeVisible()
  })

  test('the time machine colours the world by decade and narrows the lists', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    await page.getByRole('button', { name: 'Time machine' }).click()
    const machine = page.getByRole('region', { name: 'Time machine' })
    await expect(machine).toContainText('1960s')
    await expect(page.locator('.countries.has-heat')).toHaveCount(1)
    await expect(page.locator('.gravity.is-music')).toBeVisible()
    await expect(page.locator('.gravity-trail.is-music')).toHaveAttribute('d', /M/)

    await machine.getByRole('slider', { name: 'Decade' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(machine).toContainText('1970s')
    await expect(page).toHaveURL(/decade=1970/)

    await panel(page).getByRole('tab', { name: 'Artists' }).click()
    const chip = panel(page).getByRole('button', { name: /Show all decades/ })
    await expect(chip).toContainText('1970s')
    await expect(panel(page).getByText(/born and bands formed here in the 1970s/)).toBeVisible()
    await chip.click()
    await expect(machine).toHaveCount(0)
    await expect(page).not.toHaveURL(/decade=/)
  })

  test('the time machine shows a country’s number ones year by year, and plays them', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto('/?country=de&decade=1960')
    await expect(panel(page).getByRole('tab', { name: 'Hits' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel(page).getByRole('heading', { name: 'Number ones in Germany, 1960' })).toBeVisible()

    const years = panel(page).getByRole('group', { name: 'Year' })
    await years.getByRole('button', { name: '1965' }).click()
    await expect(years.getByRole('button', { name: '1965' })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page).getByRole('heading', { name: 'Number ones in Germany, 1965' })).toBeVisible()
    const song = panel(page).locator('li', { hasText: 'Kleine Annabell' })
    await expect(song).toContainText('Ronny')
    await expect(song).toContainText(/weeks? at No\. 1/)
    await song.getByRole('button', { name: /Kleine Annabell by Ronny/ }).click()
    await expect.poll(() => music.previews.map((url) => url.searchParams.get('title'))).toContain('Kleine Annabell')

    // Moving the slider moves the list to that decade.
    await page.getByRole('region', { name: 'Time machine' }).getByRole('slider', { name: 'Decade' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(panel(page).getByRole('heading', { name: /^Number ones in Germany, 197\d$/ })).toBeVisible()

    await panel(page).getByRole('button', { name: 'Today’s chart' }).click()
    await expect(page).not.toHaveURL(/decade=/)
    await expect(panel(page).getByRole('heading', { name: 'Top songs in Germany' })).toBeVisible()
  })

  test('Hungary’s 1960s show the Táncdalfesztivál, and a decade without a chart says so', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu&decade=1960')
    await expect(panel(page).getByRole('heading', { name: 'Táncdalfesztivál 1966' })).toBeVisible()
    await expect(panel(page).locator('li', { hasText: 'Nem leszek a játékszered' })).toContainText('1st prize')

    // The nearest decade with a chart is offered: from the 1990s, the 2000s (MAHASZ from 2002).
    await page.goto('/?country=hu&decade=1990')
    await expect(panel(page).getByText('No chart for Hungary from the 1990s')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Go to the 2000s' }).click()
    await expect(page).toHaveURL(/decade=2000/)
    await expect(panel(page).getByRole('heading', { name: /^Number ones in Hungary, 200\d$/ })).toBeVisible()
  })

  test('a searched song shows where and when it was number one, and opens that year’s list', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('combobox').fill('kleine annabell')
    await page.getByRole('option', { name: /Kleine Annabell · Ronny/ }).click()

    const card = page.getByRole('region', { name: 'About “Kleine Annabell”' })
    await expect(card).toContainText('First at No. 1 in 1965, in Germany')
    await expect(page.locator('.country.is-charting')).toHaveCount(1)
    // Its cover and release date are asked of Deezer by title.
    await expect.poll(() => music.previews.some((url) => url.searchParams.get('title') === 'Kleine Annabell' && url.searchParams.get('details') === '1')).toBe(true)

    await card.getByRole('button', { name: 'Germany’s number ones of 1965' }).click()
    await expect(page).toHaveURL(/country=de/)
    await expect(page).toHaveURL(/decade=1960/)
    await expect(panel(page).getByRole('heading', { name: 'Number ones in Germany, 1965' })).toBeVisible()
    await expect(panel(page).locator('li[aria-current="true"]')).toContainText('Kleine Annabell')
  })

  test('a searched artist shows where they come from, their era, songs and number ones', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    // Hungarian artists go by their Hungarian name; the English order finds her too.
    await page.getByRole('combobox').fill('kati kovacs')
    await page.getByRole('option', { name: /^Kovács Kati · Verpelét, Hungary/ }).click()

    const card = page.getByRole('region', { name: 'About Kovács Kati' })
    await expect(card).toContainText('Born 1944')
    await expect(card).toContainText('Verpelét, Hungary')
    // Number ones 1966–1972 and releases 1972–1999.
    await expect(card).toContainText('Active 1966–1999')
    await expect(card).toContainText('Közel a naphoz')
    await card.getByRole('button', { name: /Kovács Kati hit one/ }).click()
    await expect.poll(() => music.previews.some((url) => url.searchParams.get('track') === '7001')).toBe(true)

    // Her number ones, and back from one of them.
    await card.getByRole('button', { name: /Nem leszek a játékszered/ }).click()
    const song = page.getByRole('region', { name: 'About “Nem leszek a játékszered”' })
    await expect(song).toContainText('festival')
    await song.getByRole('button', { name: 'All of Kovács Kati’s number ones' }).click()

    // A decade of hers opens the time machine there, with Hungary's number ones of the time.
    await card.getByRole('button', { name: /^1960s:/ }).click()
    await expect(page).toHaveURL(/decade=1960/)
    await expect(panel(page).getByRole('heading', { name: 'Táncdalfesztivál 1966' })).toBeVisible()
    await card.getByRole('button', { name: 'Show Verpelét on the globe' }).click()
    await expect(page).toHaveURL(/country=hu&(city|place)=Q/)
  })

  test('Hungarian musicians and bands are found, with where they come from', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    for (const [query, option] of [
      ['koncz zsuzsa', /^Koncz Zsuzsa · Pély, Hungary/],
      ['halott penz', /^Halott Pénz/],
      ['quimby', /^Quimby/],
    ] as const) {
      await page.keyboard.press('ControlOrMeta+k')
      await page.getByRole('combobox').fill(query)
      await expect(page.getByRole('option', { name: option }).first()).toBeVisible()
      await page.keyboard.press('Escape')
    }
  })

  test('any song can be found on Deezer, with its artist and where they come from', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('combobox').fill('gyongyhaju')
    await page.getByRole('option', { name: /Gyöngyhajú lány · Omega/ }).click()
    const card = page.getByRole('region', { name: 'About “Gyöngyhajú lány”' })
    await expect(card).toContainText('Album: Omega Red Star')
    // The artist index knows the band: formed in Budapest.
    await expect(card).toContainText('Budapest, Hungary')
    await expect(card).toContainText('Not a number one')
    await card.getByRole('button', { name: 'More about Omega' }).click()
    await expect(page.getByRole('region', { name: 'About Omega' })).toContainText('Formed 1962')
  })

  test('the all-time Top 30 lists songs with where their artists come from', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Global Top 100' }).click()
    await page.getByRole('group', { name: 'Which chart' }).getByRole('button', { name: 'All time' }).click()
    await expect(page).toHaveURL(/view=alltime/)
    const panel = page.locator('aside[aria-labelledby="global-heading"]')
    await expect(panel.getByRole('heading', { level: 2, name: 'All-time Top 30' })).toBeVisible()
    const rows = panel.locator('ol[aria-label="All-time Top 30"] > li')
    await expect(rows).toHaveCount(30)
    await expect(rows.first()).toContainText(/No\. 1 in \d+ of \d+ countries/)
    await expect(page.locator('.country.is-charting').first()).toBeAttached()

    // A song opens its card, an artist theirs.
    await rows.nth(3).getByRole('button').first().click()
    await expect(page.getByRole('region', { name: /^About “/ })).toContainText('At No. 1 in')
    await rows.nth(3).getByRole('button', { name: /^More about / }).click()
    await expect(page.getByRole('region', { name: /^About (?!“)/ })).toBeVisible()

    await page.getByRole('group', { name: 'Which chart' }).getByRole('button', { name: 'Right now' }).click()
    await expect(page).toHaveURL(/view=top100/)
  })

  test('the time machine’s scale sits under the decades it names', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?decade=2000')
    const machine = page.getByRole('region', { name: 'Time machine' })
    const slider = (await machine.getByRole('slider', { name: 'Decade' }).boundingBox())!
    const label = (await machine.getByText('2000', { exact: true }).boundingBox())!
    // 2000 is stop 16 of 0–18; the 16px thumb's centre runs from 8px to width − 8px.
    const thumb = slider.x + 8 + ((slider.width - 16) * 16) / 18
    expect(Math.abs(label.x + label.width / 2 - thumb)).toBeLessThan(3)
  })

  test('day and night are shaded, and can be turned off', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    const night = page.locator('.night path').first()
    await expect(night).toHaveAttribute('d', /M/)
    const toggle = page.getByRole('button', { name: 'Show day and night' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(night).toHaveAttribute('d', '')
  })

  test('two charts can be compared', async ({ page }) => {
    await mockAll(page)
    await page.goto(`/?country=fr&city=${PARIS}`)
    await panel(page).getByRole('button', { name: 'Compare with another place' }).click()
    await panel(page).getByLabel('Place to compare with').fill('hungary')
    await panel(page).getByRole('button', { name: /^Hungary National chart/ }).click()
    const comparison = panel(page).getByRole('region', { name: 'Paris compared with Hungary' })
    await expect(comparison).toContainText('10 songs in both charts')
    await expect(comparison).toContainText('Only in Paris · 15')
    await comparison.getByRole('button', { name: 'Done' }).click()
    await expect(comparison).toHaveCount(0)
  })

  test('a song shows where else it is charting', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    await panel(page).getByRole('button', { name: 'Where else is hu hit 1 charting?' }).click()
    const card = page.getByRole('region', { name: 'Where hu hit 1 is charting' })
    await expect(card).toContainText('In the charts of 3 of 4 countries')
    await expect(card).toContainText('France')
    await expect(page.locator('.country.is-charting')).toHaveCount(3)
    await card.getByRole('button', { name: /^United States/ }).click()
    await expect(heading(page, 'United States')).toBeVisible()
  })

  test('musical neighbours list and colour the countries that listen alike', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    await panel(page).getByRole('button', { name: 'Who listens like Hungary?' }).click()
    const neighbours = panel(page).getByRole('region', { name: 'Countries that listen like Hungary' })
    await expect(neighbours).toContainText('France')
    await expect(neighbours).toContainText('United States')
    await expect(neighbours).not.toContainText('Germany')
    await expect(page.locator('.countries.has-heat.tone-accent')).toHaveCount(1)

    await neighbours.getByRole('button', { name: 'Compare Hungary’s chart with France’s' }).click()
    await expect(panel(page).getByRole('region', { name: 'Hungary compared with France' })).toBeVisible()
  })

  test('the quiz plays a hit and scores a guess on the globe', async ({ page }) => {
    const music = await mockAll(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Where’s it from? quiz' }).click()
    const quiz = page.getByRole('region', { name: 'Where’s it from? quiz' })
    await quiz.getByRole('button', { name: /^Where\?/ }).click()
    await expect(quiz.getByText('Click the country you think this hit is from.')).toBeVisible()
    expect(music.previews.length).toBeGreaterThan(0)
    await expect(quiz).toContainText('Round 1/10')

    // A click on the globe is a guess, not a country to open.
    await page.locator(HUNGARY).click()
    await expect(quiz).toContainText(/Spot on!|You picked Hungary, [\d,]+ km away\./)
    await expect(panel(page)).toHaveCount(0)
    await quiz.getByRole('button', { name: 'Next song →' }).click()
    await expect(quiz).toContainText('Round 2/10')
    await quiz.getByRole('button', { name: 'Skip this one' }).click()
    await expect(quiz).toContainText('Skipped.')

    await page.keyboard.press('Escape')
    await expect(quiz).toHaveCount(0)
  })

  test('the quiz can ask for the decade instead', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Where’s it from? quiz' }).click()
    const quiz = page.getByRole('region', { name: 'Where’s it from? quiz' })
    await quiz.getByRole('button', { name: /^When\?/ }).click()
    const decades = quiz.getByRole('group', { name: 'Decade the artist was born or formed in' })
    await decades.getByRole('button', { name: '1960s' }).click()
    await expect(quiz).toContainText(/Right decade!|You said the 1960s; it was the \d{4}s\./)
    await expect(quiz).toContainText(/born or formed \d{4}/)
  })

  test('the interface switches to Hungarian and remembers it', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    await expect(heading(page, 'Hungary')).toBeVisible()
    await page.getByRole('button', { name: /switch to Hungarian/ }).click()

    await expect(page.locator('html')).toHaveAttribute('lang', 'hu')
    await expect(heading(page, 'Magyarország')).toBeVisible()
    await expect(panel(page).getByRole('heading', { name: 'Toplista: Magyarország' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Időgép' })).toBeVisible()
    // Curated texts are translated too.
    await expect(panel(page).getByText(/Bartók Béla és Kodály Zoltán/)).toBeVisible()

    await page.reload()
    await expect(heading(page, 'Magyarország')).toBeVisible()
    await page.getByRole('button', { name: /Switch to English/ }).click()
    await expect(heading(page, 'Hungary')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('films have posters and link to IMDb', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    await panel(page).getByRole('tab', { name: 'Films' }).click()
    const imdb = panel(page).getByRole('link', { name: /on IMDb$/ }).first()
    await expect(imdb).toHaveAttribute('href', /^https:\/\/www\.imdb\.com\/title\/tt\d+\/$/)
    await expect(panel(page).locator('img[src*="wikimedia.org"]').first()).toBeVisible()
  })

  test('search finds a genre and opens its Sounds tab', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder('Countries, cities, songs, artists…').fill('fado')
    await page.getByRole('option', { name: /^Fado · Portugal/ }).click()
    await expect(heading(page, 'Portugal')).toBeVisible()
    await expect(panel(page).getByRole('tab', { name: 'Sounds' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('radio', { name: 'Fado', exact: true })).toHaveAttribute('aria-checked', 'true')
  })

  test('curated genres load Discogs records and switch with the arrow keys', async ({ page }) => {
    const discogs = await mockDiscogs(page)
    await mockMusic(page)
    await page.goto('/?country=br&genre=bossa-nova')
    await expect(page.getByRole('radio', { name: 'Bossa Nova' })).toHaveAttribute('aria-checked', 'true')
    await expect(records(page)).toHaveCount(3)
    expect(discogs.requests[0].searchParams.get('style')).toBe('Bossa Nova')
    expect(discogs.requests[0].searchParams.get('country')).toBe('Brazil')

    await page.getByRole('radio', { name: 'Bossa Nova' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Samba' })).toBeFocused()
    await expect(page).toHaveURL(/genre=samba/)
    await expect(records(page).first()).toContainText('Samba')
  })

  test('the Back button steps out of a city, then closes the panel', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.locator(HUNGARY).click()
    await expect(heading(page, 'Hungary')).toBeVisible()
    await panel(page).getByRole('tab', { name: 'Artists' }).click()
    await panel(page).getByRole('button', { name: /^Budapest/ }).first().click()
    await expect(heading(page, 'Budapest')).toBeVisible()
    await page.goBack()
    await expect(heading(page, 'Hungary')).toBeVisible()
    await page.goBack()
    await expect(panel(page)).toHaveCount(0)
  })

  test('dragging spins the globe', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    const country = page.locator(HUNGARY)
    const before = (await country.boundingBox())!
    await page.mouse.move(720, 450)
    await page.mouse.down()
    await page.mouse.move(520, 470, { steps: 8 })
    await page.mouse.up()
    const after = (await country.boundingBox())!
    expect(after.x).toBeLessThan(before.x - 100)
    // A drag is not a click: nothing opened.
    await expect(panel(page)).toHaveCount(0)
  })

  test('zooming in with the wheel shows cities, and a city opens from its marker', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    const box = (await page.locator(HUNGARY).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -120)
    const budapest = page.locator('.city-marker[data-city="Q1781"]')
    await expect(budapest).toBeVisible()
    await budapest.click()
    await expect(heading(page, 'Budapest')).toBeVisible()
  })

  test('the globe works from the keyboard', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    const globe = page.getByRole('application', { name: /Globe/ })
    await globe.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeFocused()
  })

  test('small island states open from their dot', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.locator('.marker[data-country="132"]').click()
    await expect(heading(page, 'Cape Verde')).toBeVisible()
  })

  test('surprise me opens a random country', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Surprise me' }).click()
    await expect(panel(page)).toBeVisible()
    await expect(page).toHaveURL(/country=\w+/)
  })

  test('shows an error with retry when the chart fails', async ({ page }) => {
    let fail = true
    await mockDiscogs(page)
    await mockMusic(page, () => (fail ? { status: 502, body: { error: 'upstream_error' } } : { status: 200, body: { source: 'apple', scope: 'country', tracks: [{ rank: 1, title: 'Back again', artist: 'A' }] } }))
    await page.goto('/?country=hu')
    await expect(panel(page).getByText('Couldn’t load the chart')).toBeVisible({ timeout: 15_000 })
    fail = false
    await panel(page).getByRole('button', { name: 'Try again' }).click()
    await expect(chartRows(page)).toHaveCount(1)
  })

  test('explains a missing Discogs token', async ({ page }) => {
    await mockDiscogs(page, () => ({ status: 500, body: { error: 'missing_token', message: 'missing' } }))
    await mockMusic(page)
    await page.goto('/?country=br&genre=samba')
    await expect(panel(page).getByText('Discogs token missing')).toBeVisible()
  })
})

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile layout only')

  test('opens a bottom sheet and drags it closed', async ({ page }) => {
    await mockAll(page)
    await page.goto('/?country=hu')
    const sheet = panel(page)
    await expect(sheet.getByRole('heading', { level: 2, name: 'Hungary' })).toBeVisible()

    const handle = sheet.getByRole('button', { name: 'Expand panel' })
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 600, { steps: 12 })
    await page.mouse.up()
    await expect(sheet).toHaveCount(0)
  })

  test('tapping a country opens it', async ({ page }) => {
    await mockAll(page)
    await page.goto('/')
    await page.locator('[data-country="012"]').tap() // Algeria: big enough to hit on a phone
    await expect(heading(page, 'Algeria')).toBeVisible()
  })
})
