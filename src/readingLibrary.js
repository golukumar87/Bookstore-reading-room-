export function normalizeReadingText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
}

export function getReadingCategory(entry) {
  return entry.book.category || entry.reader.category || 'World Classics'
}

export function getReadingLanguage(entry) {
  const language = entry.book.language || entry.reader.language
  if (language) return language.split(',')[0].trim()
  if (entry.reader.sourceUrl?.startsWith('https://hi.wikisource.org/')) return 'Hindi'
  return 'English'
}

export function filterReadingEntries(entries, query, category, language = '') {
  const normalizedQuery = normalizeReadingText(query.trim())
  return entries.filter(({ book, reader }) => {
    const matchesCategory = !category || getReadingCategory({ book, reader }) === category
    const matchesLanguage = !language || getReadingLanguage({ book, reader }) === language
    const searchableText = normalizeReadingText(
      `${book.title} ${book.author} ${getReadingCategory({ book, reader })} ${getReadingLanguage({ book, reader })}`
    )
    return matchesCategory && matchesLanguage && (!normalizedQuery || searchableText.includes(normalizedQuery))
  })
}

export function getReadingCategories(entries) {
  return [...new Set(entries.map(getReadingCategory))].sort((first, second) => first.localeCompare(second))
}

export function getReadingLanguages(entries) {
  return [...new Set(entries.map(getReadingLanguage))].sort((first, second) => first.localeCompare(second))
}

export function getReadBasedRecommendations(entries, readBookIds, limit = 6) {
  const readEntries = entries.filter(({ book }) => readBookIds.has(book.id))
  if (!readEntries.length) return []
  const readCategories = new Set(readEntries.map(getReadingCategory))
  const readLanguages = new Set(readEntries.map(getReadingLanguage))
  return entries
    .filter(({ book }) => !readBookIds.has(book.id))
    .map((entry, index) => ({
      entry,
      index,
      score: (readCategories.has(getReadingCategory(entry)) ? 2 : 0) +
        (readLanguages.has(getReadingLanguage(entry)) ? 1 : 0)
    }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, limit)
    .map(({ entry }) => entry)
}
