import { describe, expect, it } from 'vitest'
import { cellText, chartRows, cleanArtist, grid, renderWikitext, titleYears, wikitextTables } from './wikitable.ts'

const table = (rows: string) => `<table class="wikitable plainrowheaders"><tbody>${rows}</tbody></table>`

describe('wikitable', () => {
  it('renders links, footnotes, formatting and templates to their visible text', () => {
    expect(renderWikitext(`''"[[Spanish Harlem (song)|Das ist die Frage aller Fragen]]"''<ref name="x">{{cite web|url=a}}</ref>`)).toBe('"Das ist die Frage aller Fragen"')
    expect(renderWikitext(`{{sort|094|94}} {{sortname|The|Beatles}} {{dts|format=dmy|1959|12|18}}`)).toBe('94 The Beatles 1959 12 18')
    expect(renderWikitext(`Dancin{{'-}} {{ill|Jeg vil altid (elske dig for evigt)|da|lt=Jeg vil altid}}{{efn|note}}`)).toBe("Dancin' Jeg vil altid")
  })

  it('turns wikitext tables into tables chartRows reads, with MediaWiki’s cell rules', () => {
    const source = `==1960==
{| class="wikitable"
!rowspan|Issue date !! Song
! | Artist
|-
| 2 January || rowspan= "2" | "[[Kleine Annabell]]" || rowspan="2" |[[Ronny (singer)|Ronny]]
|-
| 9 January
|-
| 16 January ||| "[[Pump Up the Volume]]" ||| [[MARRS|M|A|R|R|S]]
|}
{| class="infobox"
| not a chart
|}`
    const tables = wikitextTables(source)
    expect(tables).toHaveLength(1)
    expect(tables[0].year).toBe(1960)
    expect(chartRows(tables[0].html, tables[0].year).map((row) => [row.year, row.title, row.artist])).toEqual([
      [1960, 'Kleine Annabell', 'Ronny'],
      [1960, 'Kleine Annabell', 'Ronny'],
      [1960, 'Pump Up the Volume', 'M|A|R|R|S'],
    ])
  })

  it('reads cell text without footnotes and hidden sort keys', () => {
    expect(cellText('"<a href="x">Downtown</a>"<sup class="reference">[3]</sup>')).toBe('"Downtown"')
    expect(cellText('<span style="display:none">0001</span>Petula&#160;Clark &amp; Co')).toBe('Petula Clark & Co')
  })

  it('repeats spanned cells in every row they cover', () => {
    const cells = grid(table('<tr><th>A</th><th>B</th></tr><tr><td rowspan="2">x</td><td>1</td></tr><tr><td>2</td></tr>'))
    expect(cells.map((row) => row.map((cell) => cell.text))).toEqual([
      ['A', 'B'],
      ['x', '1'],
      ['x', '2'],
    ])
    expect(cells[1][0]).toBe(cells[2][0])
  })

  it('counts a spanned song once per week, with the page’s year', () => {
    const rows = chartRows(
      table(`<tr><th>Issue date</th><th>Song</th><th>Artist</th></tr>
        <tr><td>2 January</td><td rowspan="2">"Kleine Annabell"</td><td rowspan="2">Ronny</td></tr>
        <tr><td>9 January</td></tr>
        <tr><td>16 January</td><td>"Oh, Pretty Woman"</td><td>Roy Orbison</td></tr>`),
      1965,
    )
    expect(rows.map((row) => [row.year, row.title, row.artist])).toEqual([
      [1965, 'Kleine Annabell', 'Ronny'],
      [1965, 'Kleine Annabell', 'Ronny'],
      [1965, 'Oh, Pretty Woman', 'Roy Orbison'],
    ])
    expect(rows[0].entry).toBe(rows[1].entry)
  })

  it('takes the year from year rows and dates on decade pages, and reads weeks', () => {
    const rows = chartRows(
      table(`<tr><th>Artist</th><th>Single</th><th>Week starting date</th><th>Weeks at<br>number one</th></tr>
        <tr><td colspan="4">1960</td></tr>
        <tr><td>Michael Holliday</td><td>"Starry Eyed"</td><td>29 January 1960</td><td>1</td></tr>
        <tr><td colspan="4">2002</td></tr>
        <tr><td>Shakira</td><td>"Whenever, Wherever"</td><td>13 May</td><td>3</td></tr>`),
    )
    expect(rows.map((row) => [row.year, row.title, row.weeks])).toEqual([
      [1960, 'Starry Eyed', 1],
      [2002, 'Whenever, Wherever', 3],
    ])
  })

  it('reads two song/artist pairs per row, Hungarian headers and prizes', () => {
    const rows = chartRows(
      table(`<tr><th>Díj</th><th>Előadó</th><th>Dal</th><th>Előadó</th><th>Dal</th></tr>
        <tr><td>1. díj</td><td>Kovács Kati</td><td>Nem leszek a játékszered</td><td>Ambrus Kyri</td><td>Elég, elég</td></tr>`),
      1966,
    )
    expect(rows.map((row) => [row.title, row.artist, row.note])).toEqual([
      ['Nem leszek a játékszered', 'Kovács Kati', '1. díj'],
      ['Elég, elég', 'Ambrus Kyri', '1. díj'],
    ])
  })

  it('reads Billboard’s early tables, with the artist under the title in the same cell', () => {
    const rows = chartRows(
      table(`<tr><th>Issue date</th><th>Best Sellers in Stores</th><th>Most Played by Jockeys</th></tr>
        <tr><td>January 7</td><td>"Mule Train"<br><small>Frankie Laine</small></td><td>"Other"<br><small>Someone</small></td></tr>
        <tr><td>July 1</td><td>"Teddy Bear" /<br>"Loving You"<br><small>Elvis Presley</small></td><td>"Other"<br><small>Someone</small></td></tr>`),
      1950,
    )
    expect(rows.map((row) => [row.title, row.artist])).toEqual([
      ['Mule Train', 'Frankie Laine'],
      ['Teddy Bear / Loving You', 'Elvis Presley'],
    ])
  })

  it('takes quotes off an artist written like a title, but not out of a name', () => {
    expect(cleanArtist('"The Beatles"')).toBe('The Beatles')
    expect(cleanArtist('Nat "King" Cole')).toBe('Nat "King" Cole')
  })

  it('skips tables without a song and an artist column', () => {
    expect(chartRows(table('<tr><th>Weeks at No. 1</th><th>Artist</th></tr><tr><td>12</td><td>The Beatles</td></tr>'))).toEqual([])
  })

  it('knows which years a page covers', () => {
    expect(titleYears('List of number-one hits of 1965 (Germany)')).toEqual([1965])
    expect(titleYears('List of UK singles chart number ones of the 1960s')).toHaveLength(10)
    expect(titleYears('Táncdalfesztivál ’66')).toEqual([1966])
    expect(titleYears('List of number-one singles from 1968 to 1979 (Switzerland)')).toHaveLength(12)
  })
})
