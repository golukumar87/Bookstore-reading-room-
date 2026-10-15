import React, { useMemo } from 'react'
import { useAccessibility } from '../accessibility'

function SearchDropdown({ query, items, onPick, activeIndex = -1, listId = 'book-search-suggestions' }) {
  const { t } = useAccessibility()
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 5)
    return items.filter((it) => `${it.label} ${it.meta} ${it.category || ''} ${it.language || ''}`.toLowerCase().includes(q)).slice(0, 7)
  }, [items, query])

  return (
    <div className="search-suggestions" id={listId} role="listbox" aria-label={t('Search suggestions')}>
      {filtered.length === 0 ? (
        <div className="suggestion-item" style={{ cursor: 'default' }} role="presentation">
          <div>❌ {t('No results')}</div>
        </div>
      ) : (
        filtered.map((it, idx) => (
          <div
            key={it.id}
            className="suggestion-item"
            id={`site-search-option-${idx}`}
            data-active={activeIndex === idx}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick?.(it)
            }}
            role="option"
            aria-selected={activeIndex === idx}
            tabIndex={-1}
            data-suggestion-idx={idx}
          >
            <span style={{ fontSize: 18 }}>📘</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{it.label}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                {[it.meta, it.category, it.language].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))
      )}
    </div>

  )
}

export default SearchDropdown
