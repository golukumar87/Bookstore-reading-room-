import React, { lazy, Suspense } from 'react'
import SectionHeroNav from './SectionHeroNav'
import { useAccessibility } from '../accessibility'

const BookScene = lazy(() => import('./BookScene'))

function HeroSection({ onOpenSection, onExplore, onBestsellers, bookCount }) {
  const { t } = useAccessibility()
  return (
    <section className="hero" id="main-content" tabIndex="-1">
      <div className="hero-content">
        <div className="hero-kicker"><span /> {t('A book for every kind of day')}</div>
        <h1>
          📖 {t('Discover Your Next')} <br /> <span>{t('Favorite Book')}</span>
        </h1>
        <p>{t('Find stories to get lost in, ideas to grow with, and new worlds to explore.')}</p>
        <div className="hero-buttons">
          <button className="btn-primary" type="button" onClick={onExplore}>
            {t('Explore Books')}
          </button>
          <button className="btn-secondary" type="button" onClick={onBestsellers}>
            {t('Bestsellers')}
          </button>
        </div>

        <SectionHeroNav onOpen={(id) => onOpenSection?.(id)} />
      </div>
      <div className="hero-image">
        <Suspense fallback={<div className="hero-scene-loading" aria-hidden="true">📚</div>}>
          <BookScene bookCount={bookCount} />
        </Suspense>
      </div>

    </section>
  )
}

export default HeroSection
