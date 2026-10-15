import React, { useEffect, useMemo } from 'react'
import { FaTimes } from 'react-icons/fa'
import BookCover from './BookCover'
import { useAccessibility } from '../accessibility'

function BookImageDetailsModal({
  book,
  onClose,
  onAdd,
  onBuy,
  relatedBooks = [],
  onOpenRelated
}) {
  const { t } = useAccessibility()
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const rating = book?.rating ?? 0
  const originalPrice = Math.ceil((Number(String(book?.price ?? '').replace(/[^0-9]/g, '')) || 0) / 0.8)
  const stars = useMemo(() => {
    const nodes = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 !== 0

    // tiny inline star rendering to avoid importing icons here
    const Star = ({ filled }) => (
      <span style={{ color: filled ? '#ffd700' : '#ddd', fontSize: 14 }}>★</span>
    )
    const HalfStar = () => (
      <span style={{ color: '#ffd700', fontSize: 14, position: 'relative' }}>
        ★
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '50%',
            overflow: 'hidden',
            color: '#ddd',
            whiteSpace: 'nowrap'
          }}
        >
          ★
        </span>
      </span>
    )

    for (let i = 0; i < fullStars; i++) nodes.push(<Star key={i} filled />)
    if (hasHalf) nodes.push(<HalfStar key="half" />)
    return nodes
  }, [rating])

  if (!book) return null

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose?.()
      }}
    >
      <div className="modal modal-image-details" role="dialog" aria-modal="true" aria-label={t('book details')}>
        <button className="modal-close" onClick={onClose} aria-label={t('Close')} type="button">
          <FaTimes />
        </button>

        <div className="image-details-layout">
          <div className="image-details-left">
            <BookCover className="details-image details-image-lg" src={book.image} title={book.title} author={book.author} loading="lazy" />
          </div>

          <div className="image-details-right">
            <div className="details-title-row">
              <h2 className="details-title">{book.title}</h2>
              <span className="details-discount">20% OFF</span>
            </div>

            <div className="author">by {book.author}</div>

            <div className="rating rating-big">
              {stars} <span>({rating})</span>
            </div>

            <div className="price">
              <span className="current">{book.price}</span>
              <span className="original">₹{originalPrice}</span>
            </div>

            <div className="details-actions">
              <button className="btn-primary-large" type="button" onClick={() => onBuy?.(book)}>
                {t('Buy now')}
              </button>
              <button className="btn-secondary-large" type="button" onClick={() => onAdd?.(book)}>
                {t('Add to Cart')}
              </button>
            </div>

            <div className="details-hint">
              {t('Mock details for UI/UX demo. Rating and price are static for this sample.')}
            </div>

            <div className="related-wrap">
              <div className="related-title">{t('Related books')}</div>
              <div className="related-grid">
                {relatedBooks.length === 0 ? (
                  <div className="related-empty">{t('No related books found.')}</div>
                ) : (
                  relatedBooks.slice(0, 6).map((rb) => (
                    <button
                      key={rb.id}
                      type="button"
                      className="related-item"
                      onClick={() => onOpenRelated?.(rb)}
                    >
                      <BookCover className="related-thumb" src={rb.image} title={rb.title} author={rb.author} />
                      <div className="related-meta">
                        <div className="related-name">{rb.title}</div>
                        <div className="related-author">{rb.author}</div>
                        <div className="related-price">{rb.price}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookImageDetailsModal
