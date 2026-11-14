import { describe, expect, it } from 'vitest'
import { tidyReleases } from './discography.ts'

describe('tidyReleases', () => {
  it('keeps each title once at its earliest date, oldest first, without compilations', () => {
    const releases = tidyReleases([
      { title: 'Abbey Road (Remastered 2009)', release_date: '2009-09-09', record_type: 'album' },
      { title: 'Please Please Me', release_date: '1963-03-22', record_type: 'album' },
      { title: 'Abbey Road', release_date: '1969-09-26', record_type: 'album' },
      { title: '1', release_date: '2000-11-13', record_type: 'compile' },
      { title: 'Lost', release_date: '0000-00-00', record_type: 'single' },
    ])
    expect(releases.map((release) => [release.title, release.date])).toEqual([
      ['Please Please Me', '1963-03-22'],
      ['Abbey Road', '1969-09-26'],
    ])
  })
})
