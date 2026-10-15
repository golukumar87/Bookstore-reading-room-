import React from 'react'
import { useAccessibility } from '../accessibility'

function AboutSection({ onClose }) {
  const { t } = useAccessibility()

  return (
    <section className="about-panel">
      <div className="about-card">
        <h2>📘 {t('About BookStore')}</h2>
        <p>
          {t('BookStore is a modern bookstore experience designed for readers who want fast discovery, trusted shopping, and a smooth reading journey in one place. It combines curated book collections, personalized recommendations, and an easy-to-use cart and checkout flow to make browsing and buying books feel effortless.')}
        </p>
        <p>
          {t('From bestselling fiction and business reads to self-help, children’s books, and free public-domain editions, the store helps customers explore categories, shortlist favorites, and continue reading without losing momentum. The interface is tailored for comfort, clarity, and accessibility across devices.')}
        </p>
        <div className="about-bullets">
          <div className="about-bullet">✅ {t('Curated discovery with trending and category-based recommendations')}</div>
          <div className="about-bullet">✅ {t('Smart wishlist, cart, and order tracking for a smoother buying journey')}</div>
          <div className="about-bullet">✅ {t('Reader-first experience with online reading previews and progress tracking')}</div>
          <div className="about-bullet">✅ {t('Accessible and responsive design with profile, login, and support flows')}</div>
        </div>
        <div className="about-actions">
          <button className="btn-primary-large" onClick={onClose} type="button">
            {t('Back')}
          </button>
        </div>
      </div>
    </section>
  )
}

export default AboutSection
