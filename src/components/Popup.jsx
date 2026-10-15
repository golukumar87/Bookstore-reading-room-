import React, { useEffect, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { useAccessibility } from '../accessibility'

function Popup({ onClose, onClaim }) {
  const { t } = useAccessibility()
  const [email, setEmail] = useState('')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose?.()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label={t('Close')}>
          <FaTimes />
        </button>

        <div className="modal-header">
          <h2>🎉 {t('Welcome to BookStore!')}</h2>
          <p>
            {t('Get')} <strong>20% {t('off')}</strong> {t('on your first order')}
          </p>
        </div>

        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault()
            onClaim?.(email.trim())
          }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder={t('Enter your email')}
            aria-label={t('Email address')}
            required
          />
          <button className="btn-primary-large" type="submit">
            {t('Claim Offer')}
          </button>
        </form>

        <p className="modal-footer">{t('No spam, unsubscribe anytime')}</p>
      </div>
    </div>
  )
}

export default Popup
