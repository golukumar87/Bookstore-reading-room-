import { describe, expect, it } from 'vitest'
import {
  filterReadingEntries,
  getReadBasedRecommendations,
  getReadingCategories,
  getReadingLanguage,
  getReadingLanguages
} from './readingLibrary'

const entries = [
  { book: { id: 'cafe', title: 'Café Stories', author: 'A. Writer', category: 'Fiction' }, reader: {} },
  { book: { id: 'sea', title: 'Sea Tales', author: 'B. Author', category: 'Poetry' }, reader: {} },
  { book: { id: 'river', title: 'The River', author: 'C. Writer' }, reader: { category: 'Fiction' } },
  { book: { id: 'hindi', title: 'Hindi Story', author: 'D. Writer', category: 'Fiction' }, reader: { sourceUrl: 'https://hi.wikisource.org/wiki/example' } }
]

describe('reading library filters', () => {
  it('searches titles, authors and categories without accent sensitivity', () => {
    expect(filterReadingEntries(entries, 'cafe', '')).toEqual([entries[0]])
    expect(filterReadingEntries(entries, 'b. author', '')).toEqual([entries[1]])
    expect(filterReadingEntries(entries, 'fiction', '')).toEqual([entries[0], entries[2], entries[3]])
    expect(filterReadingEntries(entries, 'hindi', '')).toEqual([entries[3]])
  })

  it('combines category selection with search and exposes sorted categories', () => {
    expect(filterReadingEntries(entries, 'writer', 'Fiction')).toEqual([entries[0], entries[2], entries[3]])
    expect(filterReadingEntries(entries, '', 'Missing')).toEqual([])
    expect(getReadingCategories(entries)).toEqual(['Fiction', 'Poetry'])
  })

  it('filters by language and recommends unread titles matching reading category', () => {
    expect(getReadingLanguage(entries[3])).toBe('Hindi')
    expect(getReadingLanguages(entries)).toEqual(['English', 'Hindi'])
    expect(filterReadingEntries(entries, '', 'Fiction', 'Hindi')).toEqual([entries[3]])
    expect(getReadBasedRecommendations(entries, new Set(['cafe']))).toEqual([entries[2], entries[3], entries[1]])
    expect(getReadBasedRecommendations(entries, new Set())).toEqual([])
  })
})
