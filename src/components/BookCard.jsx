import React from 'react'
import { FaHeart, FaShareAlt, FaStar, FaStarHalfAlt } from 'react-icons/fa'
import BookCover from './BookCover'
import { useAccessibility } from '../accessibility'

function BookCard({
  id,
  title,
  author,
  price,
  image,
  rating,
  onAdd,
  onOpenDetails,
  onBuy,
  onReadOnline,
  onShare,
  onToggleWishlist,
  isWishlisted = false,
  onOpenImage
}) {
  const { t } = useAccessibility()
  const originalPrice = Math.ceil((Number(String(price).replace(/[^0-9]/g, '')) || 0) / 0.8)

  const renderRating = () => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<FaStar key={i} className="star filled" />)
    }
    if (hasHalf) {
      stars.push(<FaStarHalfAlt key="half" className="star half" />)
    }
    return stars
  }

  return (
    <div
      className="book-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails?.({ id, title, author, price, image, rating })}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) onOpenDetails?.({ id, title, author, price, image, rating })
      }}
    >

      <div
        className="book-image"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          onOpenImage?.({ id, title, author, price, image, rating })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onOpenImage?.({ id, title, author, price, image, rating })
          }
        }}
      >

        <button
          type="button"
          className="book-icon-btn book-fav-btn"
          onClick={(e) => {
            e.stopPropagation()
            onToggleWishlist?.({ id, title })
          }}
          aria-label={`${t('toggle wishlist')}: ${title}`}
          aria-pressed={isWishlisted}
        >
          <FaHeart style={{ color: isWishlisted ? '#ff3b3b' : undefined }} />
        </button>



        <button
          type="button"
          className="book-icon-btn book-share-btn"
          onClick={(e) => {
            e.stopPropagation()
            onShare?.({ title, image })
          }}
          aria-label={`${t('share')}: ${title}`}
        >
          <FaShareAlt />
        </button>

        <BookCover src={image} title={title} author={author} />
        <span className="discount-badge">20% OFF</span>
      </div>
      <div className="book-details">
        <h3>{title}</h3>

        <p className="author">{author}</p>
        <div className="rating">
          {renderRating()} <span>({rating})</span>
        </div>
        <div className="price">
          <span className="current">{price}</span>
          <span className="original">₹{originalPrice}</span>
        </div>
        <button
          className="buy-now"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onBuy?.({ title, author, price, image, rating })
          }}
        >
          {t('Buy now')}
        </button>

        {onReadOnline && (
          <button
            className="book-read-online"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onReadOnline()
            }}
          >
            <span aria-hidden="true">📖</span> {t('Read online')}
          </button>
        )}

        <button
          className="add-to-cart"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAdd?.({ title, author, price, image, rating })
          }}
        >
          {t('Add to Cart')}
        </button>

      </div>

    </div>
  )
}

export default BookCard
