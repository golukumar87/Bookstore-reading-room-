import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaSearch, FaShoppingCart, FaClipboardList, FaBars, FaSignOutAlt, FaUserCircle, FaAdjust, FaRedoAlt } from 'react-icons/fa'
import SearchDropdown from './SearchDropdown'
import { useAccessibility } from '../accessibility'

function Header({ cartCount = 0, books = [], user, onSearchQuery, onPickBook, onOpenHome, onOpenProfile, onOpenTrack, onOpenCart, onOpenFeatures, onLogout }) {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef(null)
  const { language, setLanguage, highContrast, setHighContrast, t } = useAccessibility()

  const suggestionBooks = useMemo(
    () => books.map((book) => ({
      ...book,
      label: book.title,
      meta: book.author,
      category: book.category,
      language: book.language
    })),
    [books]
  )
  const filteredSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return suggestionBooks.slice(0, 5)
    return suggestionBooks
      .filter((book) => `${book.label} ${book.meta} ${book.category || ''} ${book.language || ''}`.toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 7)
  }, [query, suggestionBooks])

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
    onSearchQuery?.('')
  }

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [searchOpen])

  useEffect(() => {
    const onKeyboardShortcut = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey ||
          event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement || event.target?.isContentEditable) return
      event.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKeyboardShortcut)
    return () => window.removeEventListener('keydown', onKeyboardShortcut)
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!searchOpen) return
      const target = e.target
      if (target && target.closest && target.closest('[data-search-root="1"]')) return
      closeSearch()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [searchOpen])

  const openSearch = () => setSearchOpen(true)
  return (
    <header className="header">
      <div className="header-container">
        <button className="logo logo-button" type="button" onClick={onOpenHome}>
          <h1>📚 BookStore</h1>
        </button>

        <div className="search-wrap" data-search-root="1">
          {searchOpen ? (
            <div className="search-bar" style={{ border: '2px solid rgba(255,255,255,0.25)' }}>
              <input
                ref={inputRef}
                id="site-book-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveSuggestion(-1)
                  onSearchQuery?.(e.target.value)
                }}
                placeholder={t('Search for books...')}
                aria-label={t('Search for books...')}
                aria-autocomplete="list"
                aria-controls="site-book-search-suggestions"
                aria-expanded={filteredSuggestions.length > 0}
                aria-activedescendant={activeSuggestion >= 0 ? `site-search-option-${activeSuggestion}` : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && filteredSuggestions.length) {
                    e.preventDefault()
                    setActiveSuggestion((index) => (index + 1) % filteredSuggestions.length)
                  } else if (e.key === 'ArrowUp' && filteredSuggestions.length) {
                    e.preventDefault()
                    setActiveSuggestion((index) => index <= 0 ? filteredSuggestions.length - 1 : index - 1)
                  } else if (e.key === 'Enter') {
                    const match = activeSuggestion >= 0
                      ? filteredSuggestions[activeSuggestion]
                      : suggestionBooks.find((book) => book.label.toLowerCase() === query.trim().toLowerCase())
                    if (match) {
                      onPickBook?.(match)
                      setSearchOpen(false)
                    }
                  } else if (e.key === 'Escape') {
                    closeSearch()
                  }
                }}
              />
              <button onClick={closeSearch} aria-label={t('close search')} type="button">
                <FaSearch />
              </button>
            </div>
          ) : (
            <div className="search-bar" role="button" tabIndex={0} onClick={openSearch}>
              <input readOnly value={query ? query : t('Search for books...')} aria-label={t('open search')} />
              <button aria-label={t('open search')} type="button">
                <FaSearch />
              </button>
            </div>
          )}

          {searchOpen && (
            <SearchDropdown
              query={query}
              items={suggestionBooks}
              activeIndex={activeSuggestion}
              listId="site-book-search-suggestions"
              onPick={(item) => {
                setQuery(item.label)
                onPickBook?.(item)
                setSearchOpen(false)
              }}
            />
          )}
        </div>

        <div className="nav-icons">
          <button className="icon-item icon-button profile-nav-button" type="button" onClick={onOpenProfile} aria-label={user ? `${t('Profile for')} ${user.name}` : t('Log in or create an account')}>
            {user?.avatar
              ? <img className="header-avatar" src={user.avatar} alt="" />
              : <FaUserCircle className="header-default-avatar" />}
            <span className="profile-nav-name">{user?.name || t('Log in')}</span>
          </button>

          <button className="icon-item icon-button" type="button" onClick={onOpenCart} aria-label={`${t('Cart')}, ${cartCount} ${t('items')}`}>
            <FaShoppingCart />
            <span>{t('Cart')}</span>
            <span className="badge">{cartCount}</span>
          </button>


          <button className="icon-item icon-button" type="button" onClick={onOpenTrack}>
            <FaClipboardList />
            <span>{t('Orders')}</span>
          </button>

          <button className="icon-item icon-button" type="button" onClick={onOpenFeatures}>
            <FaBars />
            <span>{t('More')}</span>
          </button>
          {user && (
            <button className="icon-item icon-button" type="button" onClick={onLogout}>
              <FaSignOutAlt />
              <span>{t('Logout')}</span>
            </button>
          )}
          <div className="accessibility-controls" role="group" aria-label={t('Accessibility')}>
            <button
              type="button"
              className="accessibility-control replay-intro-control"
              onClick={() => navigate('/welcome')}
              aria-label={t('Replay intro')}
              title={t('Replay intro')}
            >
              <FaRedoAlt />
            </button>
            <label className="accessibility-language">
              <span className="visually-hidden">{t('Language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('Language')}>
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
              </select>
            </label>
            <button
              type="button"
              className="accessibility-control"
              onClick={() => setHighContrast((enabled) => !enabled)}
              aria-label={t(highContrast ? 'Turn off high contrast' : 'Turn on high contrast')}
              aria-pressed={highContrast}
              title={t('High contrast')}
            >
              <FaAdjust /><span>◐</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
