import React from 'react'
import { useAccessibility } from '../accessibility'

function SectionNav({ activeId, onOpen }) {
  const { t } = useAccessibility()
  const items = [
    { id: 'home', label: t('Home') },
    { id: 'read', label: t('Read Online') },
    { id: 'about', label: t('About') },
    { id: 'features', label: t('Features') }
  ]

  return (
    <div className="section-nav" role="navigation" aria-label="section navigation">
      {items.map((it) => (
        <button
          key={it.id}
          className={`section-nav-btn ${activeId === it.id ? 'active' : ''}`}
          onClick={() => onOpen(it.id)}
          type="button"
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export default SectionNav
