import React, { useEffect } from 'react'
import { FaTimes, FaMinus, FaPlus } from 'react-icons/fa'
import BookCover from './BookCover'
import { useAccessibility } from '../accessibility'

function CartDrawer({
  open,
  cartItems,
  onClose,
  onInc,
  onDec,
  onRemove,
  onCheckout,
  onClearCart,
  onMoveToWishlist,
  recommendations = [],
  onAddRecommended,
  wishlistIds = [],
  discountPercent = 0
}) {
  const { t } = useAccessibility()
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const totalCount = cartItems.reduce((s, it) => s + it.qty, 0)
  const totalPrice = cartItems.reduce((s, it) => s + it.qty * (it.unitPrice ?? 0), 0)
  const discount = Math.round(totalPrice * discountPercent / 100)
  const amountDue = totalPrice - discount

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('Cart')}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose?.()
      }}
    >
      <aside className="cart-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">🛒 {t('Your Cart')}</div>
            <div className="drawer-subtitle">
              {totalCount} {t(totalCount === 1 ? 'item' : 'items')} • {t('Subtotal')} ₹{totalPrice}
              {discount > 0 && <> • {t('Welcome offer')} −₹{discount}</>}
              {' '}• {t('Total')} ₹{amountDue}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label={t('close cart')} type="button">
            <FaTimes />
          </button>
        </div>

        <div className="drawer-body">
          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">📚</div>
              <div className="empty-title">{t('Cart is empty')}</div>
              <div className="empty-desc">{t('Add a few books to see them here.')}</div>
            </div>
          ) : (
            <div className="cart-list">
              {cartItems.map((it) => (
                <div className="cart-row" key={it.id}>
                  <BookCover className="cart-thumb" src={it.image} title={it.title} author={it.author} />
                  <div className="cart-mid">
                    <div className="cart-name">{it.title}</div>
                    <div className="cart-author">{it.author}</div>
                    <div className="cart-price">{it.unitPriceDisplay}</div>
                  </div>

                  <div className="cart-right">
                    <div className="qty">
                      <button
                        className="qty-btn"
                        type="button"
                        onClick={() => (it.qty <= 1 ? onRemove?.(it.id) : onDec?.(it.id))}
                        aria-label={t('decrease quantity')}
                      >
                        <FaMinus />
                      </button>
                      <div className="qty-value" aria-label={t('quantity')}>
                        {it.qty}
                      </div>
                      <button className="qty-btn" type="button" onClick={() => onInc?.(it.id)} aria-label={t('increase quantity')}>
                        <FaPlus />
                      </button>
                    </div>

                    <button
                      className="remove-link"
                      type="button"
                      onClick={() => onMoveToWishlist?.(it)}
                      aria-label={t('Move to wishlist')}
                      title={t('Move to wishlist')}
                    >
                      {t(wishlistIds.includes(it.id) ? 'In wishlist' : 'Move to wishlist')}
                    </button>

                    <button className="remove-link" type="button" onClick={() => onRemove?.(it.id)}>
                      {t('Remove')}
                    </button>

                  </div>
                </div>
              ))}
            </div>
          )}
          {cartItems.length > 0 && recommendations.length > 0 && (
            <section className="cart-recommendations" aria-label={t('Recommended books')}>
              <h3>{t('You might also like')}</h3>
              <p>{t('Books related to your cart')}</p>
              <div className="cart-recommendation-list">
                {recommendations.map((book) => (
                  <article className="cart-recommendation" key={book.id}>
                    <BookCover className="cart-recommendation-cover" src={book.image} title={book.title} author={book.author} />
                    <div className="cart-recommendation-info">
                      <strong>{book.title}</strong>
                      <span>{book.author}</span>
                      <b>{book.price}</b>
                    </div>
                    <button type="button" className="cart-recommendation-add" onClick={() => onAddRecommended?.(book)}>
                      {t('Add')}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="drawer-footer">
          <button
            className="btn-secondary-large"
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => onClearCart?.()}
          >
            {t('Clear cart')}
          </button>

          <button
            className="btn-primary-large"
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => onCheckout?.()}
          >
            {t('Checkout')}
          </button>

          <div className="drawer-footnote">
            {discount > 0 ? `${t('Welcome offer')} ₹${discount}. ` : ''}
            {t('Secure payment by card or UPI is processed through Razorpay.')}
          </div>
        </div>

      </aside>
    </div>
  )
}

export default CartDrawer
