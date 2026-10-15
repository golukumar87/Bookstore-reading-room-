const MAX_ANNOTATIONS = 100
const MAX_READER_POSITION = 100_000

export function emptyReaderState() {
  return { position: 0, paragraphPosition: 0, bookmarks: [], highlights: [], updatedAt: new Date(0).toISOString() }
}

function normalizeAnnotation(annotation, type) {
  if (!annotation || typeof annotation !== 'object') return null
  const id = typeof annotation.id === 'string' ? annotation.id.slice(0, 80) : ''
  const sectionIndex = Number(annotation.sectionIndex)
  if (!id || !Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex > MAX_READER_POSITION) return null
  const createdAt = typeof annotation.createdAt === 'string' && Number.isFinite(Date.parse(annotation.createdAt))
    ? annotation.createdAt
    : new Date(0).toISOString()

  if (type === 'bookmark') {
    return {
      id,
      sectionIndex,
      title: typeof annotation.title === 'string' ? annotation.title.slice(0, 160) : '',
      note: typeof annotation.note === 'string' ? annotation.note.slice(0, 500) : '',
      createdAt
    }
  }

  const paragraphIndex = Number(annotation.paragraphIndex)
  const startOffset = Number(annotation.startOffset)
  const endOffset = Number(annotation.endOffset)
  const quote = typeof annotation.quote === 'string' ? annotation.quote.slice(0, 2_000) : ''
  if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0 ||
      !Number.isInteger(startOffset) || startOffset < 0 ||
      !Number.isInteger(endOffset) || endOffset <= startOffset || !quote) return null
  return {
    id,
    sectionIndex,
    paragraphIndex,
    startOffset,
    endOffset,
    quote,
    color: ['yellow', 'blue', 'green', 'pink'].includes(annotation.color) ? annotation.color : 'yellow',
    note: typeof annotation.note === 'string' ? annotation.note.slice(0, 500) : '',
    createdAt
  }
}

export function normalizeReaderState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyReaderState()
  const position = Number(value.position)
  const paragraphPosition = Number(value.paragraphPosition)
  const updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
    ? value.updatedAt
    : new Date(0).toISOString()
  return {
    position: Number.isInteger(position) && position >= 0 ? Math.min(position, MAX_READER_POSITION) : 0,
    paragraphPosition: Number.isInteger(paragraphPosition) && paragraphPosition >= 0
      ? Math.min(paragraphPosition, MAX_READER_POSITION)
      : 0,
    bookmarks: Array.isArray(value.bookmarks)
      ? value.bookmarks.slice(0, MAX_ANNOTATIONS).map((entry) => normalizeAnnotation(entry, 'bookmark')).filter(Boolean)
      : [],
    highlights: Array.isArray(value.highlights)
      ? value.highlights.slice(0, MAX_ANNOTATIONS).map((entry) => normalizeAnnotation(entry, 'highlight')).filter(Boolean)
      : [],
    updatedAt
  }
}

export function mergeReaderStates(...values) {
  const states = values.map(normalizeReaderState)
  const latest = states.reduce((winner, state) => (
    Date.parse(state.updatedAt) > Date.parse(winner.updatedAt) ? state : winner
  ), emptyReaderState())
  const mergeAnnotations = (key) => {
    const merged = new Map()
    for (const state of states) {
      for (const annotation of state[key]) {
        const existing = merged.get(annotation.id)
        if (!existing || Date.parse(annotation.createdAt) >= Date.parse(existing.createdAt)) {
          merged.set(annotation.id, annotation)
        }
      }
    }
    return [...merged.values()].slice(-MAX_ANNOTATIONS)
  }
  return {
    position: latest.position,
    paragraphPosition: latest.paragraphPosition,
    bookmarks: mergeAnnotations('bookmarks'),
    highlights: mergeAnnotations('highlights'),
    updatedAt: latest.updatedAt
  }
}

function readerStorageKey(bookId, scope) {
  return `bookstore:reader:v2:${scope}:${bookId}`
}

export function readLocalReaderState(bookId, scope = 'guest') {
  try {
    const saved = localStorage.getItem(readerStorageKey(bookId, scope))
    if (saved) return normalizeReaderState(JSON.parse(saved))
    if (scope === 'guest') {
      const legacyPage = Number(localStorage.getItem(`bookstore:reader:v1:${bookId}`))
      if (Number.isInteger(legacyPage) && legacyPage >= 0) {
        return { ...emptyReaderState(), position: legacyPage }
      }
    }
  } catch (error) {
    console.error('Could not read saved reading progress:', error)
  }
  return emptyReaderState()
}

export function writeLocalReaderState(bookId, scope, state) {
  localStorage.setItem(readerStorageKey(bookId, scope), JSON.stringify(normalizeReaderState(state)))
}

export function getSelectedParagraph(range, readerElement) {
  if (!range || !readerElement || !readerElement.contains(range.commonAncestorContainer)) return null
  const startNode = range.startContainer
  const endNode = range.endContainer
  const paragraph = startNode.nodeType === 1
    ? startNode.closest('p')
    : startNode.parentElement?.closest('p')
  if (!paragraph || !readerElement.contains(paragraph)) return null
  const endParagraph = endNode.nodeType === 1
    ? endNode.closest('p')
    : endNode.parentElement?.closest('p')
  if (paragraph !== endParagraph) return null

  const selectedText = range.toString()
  const text = paragraph.textContent || ''
  const rangeStart = (() => {
    const prefix = range.cloneRange()
    prefix.selectNodeContents(paragraph)
    prefix.setEnd(startNode, range.startOffset)
    return prefix.toString().length
  })()
  const rangeEnd = rangeStart + selectedText.length
  const paragraphIndex = Number(paragraph.dataset.paragraphIndex)
  if (!selectedText.trim() || rangeEnd > text.length || !Number.isInteger(paragraphIndex)) return null
  return {
    paragraphIndex,
    startOffset: rangeStart,
    endOffset: rangeEnd,
    quote: text.slice(rangeStart, rangeEnd)
  }
}

export function splitHighlightedText(text, highlights) {
  const applicable = highlights
    .filter((highlight) => highlight.startOffset < text.length && highlight.endOffset > 0)
    .sort((first, second) => first.startOffset - second.startOffset || first.endOffset - second.endOffset)
  const segments = []
  let cursor = 0
  for (const highlight of applicable) {
    const start = Math.max(cursor, Math.min(text.length, highlight.startOffset))
    const end = Math.max(start, Math.min(text.length, highlight.endOffset))
    if (start > cursor) segments.push({ text: text.slice(cursor, start), color: '' })
    if (end > start) segments.push({ text: text.slice(start, end), color: highlight.color || 'yellow', id: highlight.id })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), color: '' })
  return segments
}
