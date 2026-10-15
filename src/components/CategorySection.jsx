import React from 'react'
import { useAccessibility } from '../accessibility'

function CategorySection({ activeCategory = '', onSelect, books = [] }) {
  const { t } = useAccessibility()
  const categories = [
    { name: 'Fiction', icon: '📖' },
    { name: 'Non-Fiction', icon: '📚' },
    { name: 'Sci-Fi', icon: '🚀' },
    { name: 'Business', icon: '💼' },
    { name: 'Self-Help', icon: '🧠' },
    { name: 'Children', icon: '🧒' },
    { name: 'Indian Granth', icon: '🪔' },
    { name: 'Shayari', icon: '🖋️' },
    { name: 'Hindi Literature', icon: '📜' },
    { name: 'Indian Fiction', icon: '🇮🇳' },
    { name: 'Indian Non-Fiction', icon: '🏛️' }
  ]

  return (
    <section className="category-section">
      <div className="category-heading">
        <span>{t('Find your next favorite')}</span>
        <h2>{t('Explore by category')}</h2>
      </div>
      <div className="category-grid">
        {categories.map((cat) => (
          <button
            className={`category-item ${activeCategory === cat.name ? 'active' : ''}`}
            key={cat.name}
            type="button"
            aria-pressed={activeCategory === cat.name}
            onClick={() => onSelect?.(activeCategory === cat.name ? '' : cat.name)}
          >
            <span className="category-icon" aria-hidden="true">{cat.icon}</span>
            <span className="category-name">{t(cat.name)}</span>
            <span className="category-count">{books.filter((book) => book.category === cat.name).length} {t('books')}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default CategorySection
