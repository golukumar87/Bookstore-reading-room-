import React, { useEffect, useMemo, useState } from 'react'
import { FaStar, FaStarHalfAlt, FaTimes } from 'react-icons/fa'
import BookCover from './BookCover'
import { api } from '../api'
import { useAccessibility } from '../accessibility'

function BookDetailsModal({ book, onClose, onAdd, onReadOnline, authUser, onNeedLogin }) {
  const { t } = useAccessibility()
  const [reviews, setReviews] = useState([])
  const [reviewSummary, setReviewSummary] = useState({ count: 0, average: 0 })
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const rating = book?.rating ?? 0
  const originalPrice = Math.ceil((Number(String(book?.price ?? '').replace(/[^0-9]/g, '')) || 0) / 0.8)

  const loadReviews = async () => {
    if (!book?.id) return
    const result = await api(`/books/${encodeURIComponent(book.id)}/reviews`)
    setReviews(result.reviews)
    setReviewSummary(result.summary)
  }

  useEffect(() => {
    setReviews([])
    setReviewSummary({ count: 0, average: 0 })
    setReviewError('')
    setReviewSuccess('')
    loadReviews().catch((error) => setReviewError(error.message))
  }, [book?.id])

  const submitReview = async (event) => {
    event.preventDefault()
    if (!authUser) {
      onNeedLogin?.()
      return
    }
    setReviewLoading(true)
    setReviewError('')
    setReviewSuccess('')
    try {
      await api(`/books/${encodeURIComponent(book.id)}/reviews`, {
        method: 'POST',
        body: { rating: reviewRating, review: reviewText }
      })
      setReviewText('')
      await loadReviews()
      setReviewSuccess(t('Your verified-purchase review is published.'))
    } catch (error) {
      setReviewError(error.message)
    } finally {
      setReviewLoading(false)
    }
  }

  const stars = useMemo(() => {
    const nodes = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 !== 0
    for (let i = 0; i < fullStars; i++) nodes.push(<FaStar key={i} className="star filled" />)
    if (hasHalf) nodes.push(<FaStarHalfAlt key="half" className="star half" />)
    return nodes
  }, [rating])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!book) return null

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose?.()
      }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label={t('book details')}>
        <button className="modal-close" onClick={onClose} aria-label={t('Close')} type="button">
          <FaTimes />
        </button>

        <div className="modal-body modal-details-body">
          <div className="details-top">
            <BookCover className="details-image" src={book.image} title={book.title} author={book.author} loading="lazy" style={{ objectFit: 'cover' }} />


            <div className="details-meta">
              <div className="details-title-row">
                <h2 className="details-title">{book.title}</h2>
                <span className="details-discount">20% OFF</span>
              </div>

              <div className="author">by {book.author}</div>

              <div className="rating rating-big">
                {stars}
                <span>({rating})</span>
              </div>

              <div className="price">
                <span className="current">{book.price}</span>
                <span className="original">₹{originalPrice}</span>
              </div>

              <div className="details-actions">
                {onReadOnline && (
                  <button className="btn-secondary-large" type="button" onClick={() => onReadOnline(book)}>
                    {t('Read online')}
                  </button>
                )}
                <button className="btn-primary-large" type="button" onClick={() => onAdd?.(book)}>
                  {t('Add to Cart')}
                </button>
                <button className="btn-secondary-large" type="button" onClick={onClose}>
                  {t('Continue Shopping')}
                </button>
              </div>

              <div className="details-hint">
                {t('Mock details for UI/UX demo. Rating and price are static for this sample.')}
              </div>
            </div>
          </div>

          <div className="details-bottom">
            <div className="details-chip">📌 {t('Bestseller')}</div>
            <div className="details-chip">🕒 {t('Quick read')}</div>
            <div className="details-chip">🧠 {t('Practical insights')}</div>
          </div>
          <section className="book-reviews">
            <h3>{t('Verified-purchase reviews')}</h3>
            <p>{reviewSummary.count ? `${reviewSummary.average} / 5 ${t('from')} ${reviewSummary.count} ${t(reviewSummary.count === 1 ? 'customer review' : 'customer reviews')}` : t('No verified-purchase reviews yet.')}</p>
            {reviewError && <p className="auth-error" role="alert">{reviewError}</p>}
            {reviewSuccess && <p className="review-success" role="status">{reviewSuccess}</p>}
            <form onSubmit={submitReview} className="review-form">
              <label>{t('Rating')}
                <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
                </select>
              </label>
              <label>{t('Your review')}
                <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} minLength={8} maxLength={2000} rows={4} placeholder={t('Share your experience with this book')} required />
              </label>
              <button className="btn-secondary-large" type="submit" disabled={reviewLoading}>
                {t(reviewLoading ? 'Submitting…' : authUser ? 'Submit verified review' : 'Log in to review')}
              </button>
            </form>
            <div className="review-list">
              {reviews.map((item) => (
                <article key={item.id}>
                  <strong>{item.customerName} <span>{t('Verified purchase')}</span></strong>
                  <small>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)} · {new Date(`${item.createdAt}Z`).toLocaleDateString()}</small>
                  <p>{item.review}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default BookDetailsModal
