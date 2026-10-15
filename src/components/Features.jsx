import React from 'react'
import {
  FaTruck,
  FaShieldAlt,
  FaHeadset,
  FaGift,
  FaBookOpen,
  FaBolt,
  FaStar
} from 'react-icons/fa'
import { useAccessibility } from '../accessibility'

function Features({ onOpenAdmin }) {
  const { t } = useAccessibility()
  const features = [
    {
      icon: <FaTruck />,
      title: 'Fast Delivery',
      desc: 'Quick doorstep delivery across India with easy tracking and order updates.'
    },
    {
      icon: <FaShieldAlt />,
      title: 'Secure Checkout',
      desc: 'Protected payment flow and trusted buying experience for every order.'
    },
    {
      icon: <FaBookOpen />,
      title: 'Curated Collections',
      desc: 'Explore handpicked reads across fiction, business, self-help, and more.'
    },
    {
      icon: <FaStar />,
      title: 'Smart Recommendations',
      desc: 'Discover titles based on reading history, favorites, and popular picks.'
    },
    {
      icon: <FaBolt />,
      title: 'Instant Discovery',
      desc: 'Search, filter, and browse a wide catalog without friction or clutter.'
    },
    {
      icon: <FaHeadset />,
      title: '24/7 Support',
      desc: 'Helpful assistance for order questions, account access, and shopping guidance.'
    },
    {
      icon: <FaGift />,
      title: 'Member Offers',
      desc: 'Exclusive discounts, seasonal deals, and personalized price drops.'
    }
  ]

  return (
    <section className="features">
      <div className="features-container">
        {features.map((feature, index) => (
          <div className="feature-card" key={index}>
            <div className="feature-icon">{feature.icon}</div>
            <h3>{t(feature.title)}</h3>
            <p>{t(feature.desc)}</p>
          </div>
        ))}
      </div>
      <div className="features-admin-access">
        <div>
          <h3>{t('Store administration')}</h3>
          <p>{t('Manage customer orders, fulfillment status, inventory, and customer updates.')}</p>
        </div>
        <button type="button" className="btn-secondary-large" onClick={onOpenAdmin}>
          {t('Open admin dashboard')}
        </button>
      </div>
    </section>
  )
}

export default Features
