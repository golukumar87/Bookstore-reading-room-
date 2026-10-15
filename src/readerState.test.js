import { beforeEach, describe, expect, it } from 'vitest'
import {
  emptyReaderState,
  getSelectedParagraph,
  mergeReaderStates,
  normalizeReaderState,
  readLocalReaderState,
  splitHighlightedText,
  writeLocalReaderState
} from './readerState'

describe('reader state', () => {
  beforeEach(() => localStorage.clear())

  it('normalizes and rejects malformed annotations while merging latest position', () => {
    const state = normalizeReaderState({
      position: 4,
      paragraphPosition: 7,
      updatedAt: '2025-01-02T00:00:00.000Z',
      bookmarks: [{ id: 'bm', sectionIndex: 2, title: 'Chapter' }, { id: '', sectionIndex: -1 }],
      highlights: [{ id: 'hl', sectionIndex: 1, paragraphIndex: 0, startOffset: 1, endOffset: 4, quote: 'abc' }]
    })
    expect(state.position).toBe(4)
    expect(state.paragraphPosition).toBe(7)
    expect(state.bookmarks).toHaveLength(1)
    expect(state.highlights[0].color).toBe('yellow')
    expect(mergeReaderStates(emptyReaderState(), state).position).toBe(4)
    expect(mergeReaderStates(emptyReaderState(), state).paragraphPosition).toBe(7)
  })

  it('isolates account progress and migrates guest progress from the previous format', () => {
    writeLocalReaderState('novel', 'account-1', { ...emptyReaderState(), position: 5 })
    expect(readLocalReaderState('novel', 'account-1').position).toBe(5)
    expect(readLocalReaderState('novel', 'account-2').position).toBe(0)
    localStorage.setItem('bookstore:reader:v1:old-book', '3')
    expect(readLocalReaderState('old-book', 'guest').position).toBe(3)
  })

  it('maps text selections to offsets and splits rendered highlights safely', () => {
    const paragraph = document.createElement('p')
    paragraph.dataset.paragraphIndex = '2'
    paragraph.textContent = 'A selected passage.'
    const container = document.createElement('article')
    container.append(paragraph)
    document.body.append(container)
    const range = document.createRange()
    range.setStart(paragraph.firstChild, 2)
    range.setEnd(paragraph.firstChild, 10)
    expect(getSelectedParagraph(range, container)).toMatchObject({
      paragraphIndex: 2,
      startOffset: 2,
      endOffset: 10,
      quote: 'selected'
    })
    expect(splitHighlightedText('A selected passage.', [{
      id: 'h1', startOffset: 2, endOffset: 10, color: 'yellow'
    }])).toEqual([
      { text: 'A ', color: '' },
      { text: 'selected', color: 'yellow', id: 'h1' },
      { text: ' passage.', color: '' }
    ])
    container.remove()
  })
})
