import React, { useMemo, useState } from 'react'
import { FaBookOpen, FaShoppingBag } from 'react-icons/fa'
import BookCover from './BookCover'
import { useAccessibility } from '../accessibility'
import {
  filterReadingEntries,
  getReadingCategories,
  getReadingLanguage,
  getReadingLanguages
} from '../readingLibrary'

function ReadingLibrary({ entries, recommendations = [], readingRecommendations = [], onRead, onBuy, loading }) {
  const { t } = useAccessibility()
  const [query, setQuery] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const categories = useMemo(() => getReadingCategories(entries), [entries])
  const languages = useMemo(() => getReadingLanguages(entries), [entries])
  const filteredEntries = useMemo(
    () => filterReadingEntries(entries, query, selectedCategory, selectedLanguage),
    [entries, query, selectedCategory, selectedLanguage]
  )
  const suggestions = useMemo(
    () => query.trim() ? filterReadingEntries(entries, query, '', '').slice(0, 5) : [],
    [entries, query]
  )
  const categoryFor = ({ book, reader }) => book.category || reader.category || 'World Classics'

  const renderBookCard = ({ book, reader, purchaseBook }, keyPrefix = '') => (
    <article className="reading-book-card" key={`${keyPrefix}${book.id}`}>
      <button
        className="reading-cover-button"
        type="button"
        onClick={() => onRead(book.id)}
        aria-label={`Read ${book.title} online`}
      >
        <BookCover src={book.image || reader.image} title={book.title} author={book.author} loading="lazy" />
        <span><FaBookOpen /> Read online</span>
      </button>
      <div className="reading-book-info">
        <span className="reading-book-category">{categoryFor({ book, reader })}</span>
        <h2>{book.title}</h2>
        <p>{book.author}</p>
        <small className="reading-book-language">{getReadingLanguage({ book, reader })}</small>
        {reader.credit && <small>{reader.credit} · Source edition</small>}
        <div className="reading-book-actions">
          <button type="button" className="reader-open-button" onClick={() => onRead(book.id)}>Start reading</button>
          <button
            type="button"
            className="reader-buy-button"
            onClick={() => purchaseBook && onBuy(purchaseBook)}
            disabled={!purchaseBook}
            aria-label={purchaseBook ? `Buy ${book.title} for ${purchaseBook.price}` : `Buy ${book.title}: not available`}
            title={purchaseBook ? `Add ${purchaseBook.title} to your cart` : 'This title is not currently available in the store'}
          >
            <FaShoppingBag /> {purchaseBook ? `Buy · ${purchaseBook.price}` : 'Not available'}
          </button>
        </div>
      </div>
    </article>
  )

  return (
    <main className="reading-library" id="main-content" tabIndex="-1">
      <div className="reading-library-intro">
        <span className="reader-eyebrow"><FaBookOpen /> {t('THE READING ROOM')}</span>
        <h1>{t('Read a little. Discover a lot.')}</h1>
        <p>{t('Browse illustrated editions by category and read them here in the BookStore reader.')}</p>
        <span className="reader-edition-count">{entries.length} {t('free reading editions')}</span>
      </div>

      <div className="reading-license-note">
        {t('Free reading editions from Project Gutenberg and Wikisource open inside this app. Translation and edition details are shown with each title; copyright availability can vary by country.')}
      </div>

      {!loading && entries.length > 0 && (
        <div className="reading-library-filters" role="search" aria-label="Filter online books">
          <label>
            <span>{t('Search books')}</span>
            <div className="reading-search-field">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('Title, author, category, or language')}
                aria-label={t('Search books')}
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && suggestions.length > 0}
                aria-controls="reading-book-suggestions"
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement.contains(event.relatedTarget)) setSuggestionsOpen(false)
                }}
              />
              {suggestionsOpen && suggestions.length > 0 && (
                <div className="reading-search-suggestions" id="reading-book-suggestions" role="listbox" aria-label="Book suggestions">
                  {suggestions.map(({ book, reader }) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      key={book.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(book.title)
                        setSuggestionsOpen(false)
                      }}
                    >
                      <span>{book.title}</span>
                      <small>{book.author} · {categoryFor({ book, reader })} · {getReadingLanguage({ book, reader })}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label>
            <span>{t('Category')}</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              aria-label={t('Category')}
            >
              <option value="">{t('All categories')}</option>
              {categories.map((category) => <option key={category} value={category}>{t(category)}</option>)}
            </select>
          </label>
          <label>
            <span>{t('Language')}</span>
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              aria-label={t('Language')}
            >
              <option value="">{t('All languages')}</option>
              {languages.map((language) => <option key={language} value={language}>{t(language)}</option>)}
            </select>
          </label>
          <p role="status" aria-live="polite">
            {t(`Showing ${filteredEntries.length} of ${entries.length} books`)}
          </p>
        </div>
      )}

      {!loading && readingRecommendations.length > 0 && (
        <section className="reading-recommendations" aria-label="Recommended reading based on your reading history">
          <div className="reading-category-heading">
            <h2>{t('You may also like')}</h2>
            <span>{t('Based on the books you’ve read')}</span>
          </div>
          <div className="reading-book-grid">
            {readingRecommendations.map((entry) => renderBookCard(entry, 'reading-recommended-'))}
          </div>
        </section>
      )}

      {!loading && recommendations.length > 0 && (
        <section className="reading-recommendations" aria-label="Recommended reading based on your purchases">
          <div className="reading-category-heading">
            <h2>{t('Recommended from your reading shelf')}</h2>
            <span>{t('Based on books customers bought with titles you purchased')}</span>
          </div>
          <div className="reading-book-grid">
            {recommendations.map((entry) => renderBookCard(entry, 'recommended-'))}
          </div>
        </section>
      )}

      {loading && <p className="reader-status">{t('Loading books…')}</p>}
      {!loading && !entries.length && <p className="reader-status">{t('No online reading editions are available right now.')}</p>}
      {!loading && filteredEntries.length === 0 && entries.length > 0 && (
        <p className="reader-status">{t('No books match these filters. Try another title, category, or language.')}</p>
      )}
      {!loading && categories
        .filter((category) => !selectedCategory || category === selectedCategory)
        .map((category) => {
        const categoryEntries = filteredEntries.filter((entry) => categoryFor(entry) === category)
        if (!categoryEntries.length) return null
        return (
          <section className="reading-category-section" key={category} aria-label={category}>
            <div className="reading-category-heading">
              <h2>{category}</h2>
              <span>{categoryEntries.length} books</span>
            </div>
            <div className="reading-book-grid">
              {categoryEntries.map((entry) => renderBookCard(entry))}
            </div>
          </section>
        )
      })}
    </main>
  )
}

export default ReadingLibrary
