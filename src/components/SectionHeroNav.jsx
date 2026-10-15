import React from 'react'
import { useAccessibility } from '../accessibility'

function SectionHeroNav({ onOpen }) {
  const { t } = useAccessibility()
  return (
    <div className="hero-section-nav" aria-label="section quick actions">
      <button className="hero-section-btn" type="button" onClick={() => onOpen('features')}>
        ✨ {t('Best Features')}
      </button>
      <button className="hero-section-btn hero-section-btn-outline" type="button" onClick={() => onOpen('about')}>
        📘 {t('About Us')}
      </button>
    </div>
  )
}

export default SectionHeroNav
